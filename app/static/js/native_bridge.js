/**
 * Sear POS Native Bridge
 *
 * Provides communication between the web app and the iOS native wrapper.
 * When running inside the native app, messages go via WKWebView's postMessage.
 * When running in a browser, calls fall back to server-side API endpoints.
 *
 * Usage:
 *   // The bridge is auto-initialized as window.nativeBridge
 *   await nativeBridge.discoverReaders()
 *   await nativeBridge.connectReader(identifier)
 *   await nativeBridge.collectPayment(1299, 'order-123')
 *   await nativeBridge.printReceipt({ html: '<h1>Receipt</h1>...' })
 *   await nativeBridge.openCashDrawer()
 */

class NativeBridge {
    constructor() {
        this.isNative = !!(window.__SEAR_NATIVE__ && window.webkit?.messageHandlers?.posNative);
        this.platform = window.__SEAR_PLATFORM__ || 'web';
        this.version = window.__SEAR_NATIVE_VERSION__ || null;
        this._pendingCallbacks = {};
        this._eventListeners = {};
        this._callbackId = 0;

        // Listen for native events dispatched by posNativeCallback
        window.addEventListener('posNativeEvent', (e) => {
            const { event, data } = e.detail;
            this.handleNativeEvent(event, data);
        });
    }

    // -------------------------------------------------------------------------
    // Core messaging
    // -------------------------------------------------------------------------

    /**
     * Send a message to the native layer.
     * Returns a promise that resolves when the native layer responds.
     */
    send(action, params = {}) {
        if (this.isNative) {
            return this._sendNative(action, params);
        }
        return this._sendServer(action, params);
    }

    _sendNative(action, params) {
        return new Promise((resolve, reject) => {
            const id = ++this._callbackId;
            const timeout = setTimeout(() => {
                delete this._pendingCallbacks[id];
                reject(new Error(`Native action '${action}' timed out after 60s`));
            }, 60000);

            this._pendingCallbacks[id] = { resolve, reject, timeout, action };

            window.webkit.messageHandlers.posNative.postMessage({
                action,
                params: { ...params, _callbackId: id }
            });
        });
    }

    async _sendServer(action, params) {
        // Fallback: call the server-side hardware API
        // This allows the web app to work without the native wrapper
        // by routing through server-managed hardware (e.g., network printers)
        const response = await fetch('/api/hardware/' + action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Hardware API error: ${response.status} - ${text}`);
        }

        return response.json();
    }

    // -------------------------------------------------------------------------
    // Event handling (native -> JS)
    // -------------------------------------------------------------------------

    /**
     * Called by the native layer via posNativeCallback(event, data).
     * Routes the event to registered listeners and resolves pending promises.
     */
    handleNativeEvent(event, data) {
        // Resolve any pending callback that matches this event
        this._resolvePendingForEvent(event, data);

        // Dispatch to registered event listeners
        const listeners = this._eventListeners[event] || [];
        for (const listener of listeners) {
            try {
                listener(data);
            } catch (err) {
                console.error(`[NativeBridge] Error in listener for '${event}':`, err);
            }
        }

        // Update Alpine.js hardware store if present
        this._updateAlpineStore(event, data);
    }

    _resolvePendingForEvent(event, data) {
        // Map events to the actions that triggered them
        const eventToAction = {
            readersDiscovered: 'discoverReaders',
            readerConnected: 'connectReader',
            readerDisconnected: 'disconnectReader',
            readerConnectionFailed: 'connectReader',
            readerStatus: 'getReaderStatus',
            paymentComplete: 'collectPayment',
            paymentFailed: 'collectPayment',
            printersDiscovered: 'discoverPrinters',
            printerConnected: 'connectPrinter',
            printerDisconnected: 'disconnectPrinter',
            printComplete: 'printReceipt',
            drawerOpened: 'openCashDrawer',
            error: null // resolve any pending
        };

        const targetAction = eventToAction[event];

        // Find and resolve matching pending callbacks
        for (const [id, cb] of Object.entries(this._pendingCallbacks)) {
            if (targetAction === null || cb.action === targetAction) {
                clearTimeout(cb.timeout);

                if (event === 'paymentFailed' || event === 'readerConnectionFailed' || event === 'error') {
                    cb.reject(new Error(data.error || `Action failed: ${event}`));
                } else {
                    cb.resolve(data);
                }

                delete this._pendingCallbacks[id];
                break; // resolve one at a time
            }
        }
    }

    /**
     * Register a listener for a native event.
     * Returns an unsubscribe function.
     */
    on(event, callback) {
        if (!this._eventListeners[event]) {
            this._eventListeners[event] = [];
        }
        this._eventListeners[event].push(callback);

        return () => {
            this._eventListeners[event] = this._eventListeners[event].filter(cb => cb !== callback);
        };
    }

    // -------------------------------------------------------------------------
    // Alpine.js store integration
    // -------------------------------------------------------------------------

    _updateAlpineStore(event, data) {
        if (typeof Alpine === 'undefined' || !Alpine.store) return;

        const store = Alpine.store('hardware');
        if (!store) return;

        switch (event) {
            case 'readersDiscovered':
                store.readers = data.readers || [];
                break;
            case 'readerConnected':
                store.connectedReader = data.identifier;
                store.readerStatus = 'connected';
                break;
            case 'readerDisconnected':
                store.connectedReader = null;
                store.readerStatus = 'disconnected';
                break;
            case 'readerConnectionFailed':
                store.readerStatus = 'error';
                store.readerError = data.error;
                break;
            case 'paymentComplete':
                store.lastPayment = { ...data, timestamp: Date.now() };
                store.paymentPending = false;
                break;
            case 'paymentFailed':
                store.lastPayment = { success: false, error: data.error, timestamp: Date.now() };
                store.paymentPending = false;
                break;
            case 'printersDiscovered':
                store.printers = data.printers || [];
                break;
            case 'printerConnected':
                store.printerConnected = true;
                store.connectedPrinter = data.identifier;
                break;
            case 'printerDisconnected':
                store.printerConnected = false;
                store.connectedPrinter = null;
                break;
            case 'printComplete':
                store.lastPrint = { ...data, timestamp: Date.now() };
                break;
            case 'drawerOpened':
                store.lastDrawerOpen = Date.now();
                break;
            case 'bluetoothState':
                store.bluetoothPoweredOn = data.poweredOn;
                break;
        }
    }

    // -------------------------------------------------------------------------
    // High-level API
    // -------------------------------------------------------------------------

    /** Scan for Valor RCKT payment terminals */
    discoverReaders() {
        return this.send('discoverReaders');
    }

    /** Connect to a discovered reader by identifier */
    connectReader(identifier) {
        return this.send('connectReader', { identifier });
    }

    /** Disconnect from the current reader */
    disconnectReader() {
        return this.send('disconnectReader');
    }

    /** Get current reader connection status */
    getReaderStatus() {
        return this.send('getReaderStatus');
    }

    /**
     * Collect a payment via the connected terminal.
     * @param {number} cents - Amount in cents
     * @param {string} orderId - Order identifier
     */
    collectPayment(cents, orderId) {
        if (typeof Alpine !== 'undefined' && Alpine.store?.('hardware')) {
            Alpine.store('hardware').paymentPending = true;
        }
        return this.send('collectPayment', { cents, orderId });
    }

    /** Scan for receipt printers */
    discoverPrinters() {
        return this.send('discoverPrinters');
    }

    /** Connect to a printer (BLE by identifier, or network by host/port) */
    connectPrinter({ identifier, host, port } = {}) {
        return this.send('connectPrinter', { identifier, host, port });
    }

    /** Disconnect from the current printer */
    disconnectPrinter() {
        return this.send('disconnectPrinter');
    }

    /**
     * Print a receipt.
     * @param {Object} options - Either { html: '...' } or { header, items, totals, footer, openDrawer }
     */
    printReceipt(options) {
        return this.send('printReceipt', options);
    }

    /** Open the cash drawer via the printer's kick connector */
    openCashDrawer() {
        return this.send('openCashDrawer');
    }

    /** Print a test page */
    testPrint() {
        return this.send('testPrint');
    }
}

// -------------------------------------------------------------------------
// Initialize
// -------------------------------------------------------------------------

// Create singleton
window.nativeBridge = new NativeBridge();

// Register Alpine.js hardware store when Alpine initializes
document.addEventListener('alpine:init', () => {
    Alpine.store('hardware', {
        // State
        isNative: window.nativeBridge.isNative,
        platform: window.nativeBridge.platform,
        bluetoothPoweredOn: false,

        // Reader (payment terminal)
        readers: [],
        connectedReader: null,
        readerStatus: 'disconnected', // disconnected, connecting, connected, error
        readerError: null,

        // Payment
        paymentPending: false,
        lastPayment: null,

        // Printer
        printers: [],
        printerConnected: false,
        connectedPrinter: null,
        lastPrint: null,

        // Cash drawer
        lastDrawerOpen: null,

        // Actions
        async scanReaders() {
            this.readers = [];
            this.readerStatus = 'scanning';
            try {
                await window.nativeBridge.discoverReaders();
            } catch (err) {
                console.error('Scan failed:', err);
                this.readerStatus = 'disconnected';
            }
        },

        async connectToReader(identifier) {
            this.readerStatus = 'connecting';
            try {
                await window.nativeBridge.connectReader(identifier);
            } catch (err) {
                console.error('Connect failed:', err);
                this.readerStatus = 'error';
                this.readerError = err.message;
            }
        },

        async disconnectFromReader() {
            await window.nativeBridge.disconnectReader();
        },

        async pay(cents, orderId) {
            this.paymentPending = true;
            try {
                return await window.nativeBridge.collectPayment(cents, orderId);
            } catch (err) {
                this.paymentPending = false;
                throw err;
            }
        },

        async scanPrinters() {
            this.printers = [];
            try {
                await window.nativeBridge.discoverPrinters();
            } catch (err) {
                console.error('Printer scan failed:', err);
            }
        },

        async connectToPrinter(options) {
            try {
                await window.nativeBridge.connectPrinter(options);
            } catch (err) {
                console.error('Printer connect failed:', err);
            }
        },

        async print(options) {
            try {
                await window.nativeBridge.printReceipt(options);
            } catch (err) {
                console.error('Print failed:', err);
                throw err;
            }
        },

        async openDrawer() {
            try {
                await window.nativeBridge.openCashDrawer();
            } catch (err) {
                console.error('Drawer open failed:', err);
                throw err;
            }
        }
    });
});
