import Foundation
import WebKit
import os

/// Routes messages between the WKWebView JavaScript bridge and native hardware managers.
/// All JS messages arrive as JSON via the "posNative" WKScriptMessageHandler.
/// Responses go back via evaluateJavaScript("window.posNativeCallback(event, data)").
@MainActor
final class NativeBridge: NSObject {
    private let logger = Logger(subsystem: "com.getsear.pos", category: "NativeBridge")

    let bluetoothManager = BluetoothManager()
    let printerManager = PrinterManager()

    private weak var webView: WKWebView?

    override init() {
        super.init()
    }

    /// Attach to a web view — must be called once after the web view is created
    func attach(to webView: WKWebView) {
        self.webView = webView
        bluetoothManager.delegate = self
        printerManager.delegate = self
    }

    // MARK: - Handle Messages from JavaScript

    /// Process an incoming message from the JS bridge.
    /// Expected format: { "action": "...", "params": { ... } }
    func handleMessage(_ body: Any) {
        guard let dict = body as? [String: Any],
              let action = dict["action"] as? String else {
            logger.error("Invalid message format: \(String(describing: body))")
            sendCallback(event: "error", data: ["error": "Invalid message format"])
            return
        }

        let params = dict["params"] as? [String: Any] ?? [:]
        logger.info("Received action: \(action)")

        switch action {
        case "discoverReaders":
            bluetoothManager.scanForReaders()

        case "connectReader":
            guard let identifier = params["identifier"] as? String else {
                sendCallback(event: "error", data: ["error": "Missing reader identifier"])
                return
            }
            bluetoothManager.connect(identifier: identifier)

        case "disconnectReader":
            bluetoothManager.disconnect()
            sendCallback(event: "readerDisconnected", data: ["reason": "user"])

        case "collectPayment":
            guard let cents = params["cents"] as? Int,
                  let orderId = params["orderId"] as? String else {
                sendCallback(event: "paymentFailed", data: ["error": "Missing cents or orderId"])
                return
            }
            bluetoothManager.sendPaymentRequest(amountInCents: cents, orderId: orderId)

        case "getReaderStatus":
            let status = bluetoothManager.getReaderStatus()
            sendCallback(event: "readerStatus", data: status)

        case "discoverPrinters":
            printerManager.scanForPrinters()

        case "connectPrinter":
            if let identifier = params["identifier"] as? String {
                printerManager.connectBluetooth(identifier: identifier)
            } else if let host = params["host"] as? String {
                let port = params["port"] as? UInt16 ?? 9100
                printerManager.connectNetwork(host: host, port: port)
            } else {
                sendCallback(event: "error", data: ["error": "Missing printer identifier or host"])
            }

        case "disconnectPrinter":
            printerManager.disconnect()

        case "printReceipt":
            handlePrintReceipt(params)

        case "openCashDrawer":
            printerManager.openCashDrawer()

        case "testPrint":
            let builder = ESCPOSBuilder()
            builder.initialize()
                .alignCenter()
                .textSizeDouble()
                .boldOn()
                .printLine("SEAR POS")
                .boldOff()
                .textSizeNormal()
                .printLine("Test Print")
                .printLine("")
                .alignLeft()
                .printSeparator()
                .printColumns(left: "Printer:", right: "Connected")
                .printColumns(left: "Date:", right: {
                    let f = DateFormatter()
                    f.dateFormat = "MM/dd/yyyy hh:mm a"
                    return f.string(from: Date())
                }())
                .printSeparator()
                .printLine("")
                .alignCenter()
                .printLine("If you can read this,")
                .printLine("printing is working!")
                .printLine("")
                .feedAndCut(feedLines: 4)
            printerManager.printData(builder.build())

        default:
            logger.warning("Unknown action: \(action)")
            sendCallback(event: "error", data: ["error": "Unknown action: \(action)"])
        }
    }

    // MARK: - Print Receipt Handler

    private func handlePrintReceipt(_ params: [String: Any]) {
        // Option 1: Raw HTML string
        if let html = params["html"] as? String {
            printerManager.printReceiptFromHTML(html)
            return
        }

        // Option 2: Structured receipt data
        guard let headerDict = params["header"] as? [String: Any],
              let restaurantName = headerDict["restaurantName"] as? String,
              let itemsList = params["items"] as? [[String: Any]],
              let totalsDict = params["totals"] as? [String: Any] else {
            sendCallback(event: "error", data: ["error": "Missing receipt data (need html or header/items/totals)"])
            return
        }

        let header = ReceiptHeader(
            restaurantName: restaurantName,
            address: headerDict["address"] as? String,
            phone: headerDict["phone"] as? String,
            orderNumber: headerDict["orderNumber"] as? String,
            orderType: headerDict["orderType"] as? String,
            serverName: headerDict["serverName"] as? String,
            dateString: headerDict["dateString"] as? String ?? {
                let f = DateFormatter()
                f.dateFormat = "MM/dd/yyyy hh:mm a"
                return f.string(from: Date())
            }()
        )

        let items = itemsList.map { dict in
            ReceiptItem(
                name: dict["name"] as? String ?? "Unknown",
                quantity: dict["quantity"] as? Int ?? 1,
                priceInCents: dict["priceInCents"] as? Int ?? 0,
                modifiers: dict["modifiers"] as? [String] ?? []
            )
        }

        let totals = ReceiptTotals(
            subtotalCents: totalsDict["subtotalCents"] as? Int ?? 0,
            discountCents: totalsDict["discountCents"] as? Int ?? 0,
            taxCents: totalsDict["taxCents"] as? Int ?? 0,
            tipCents: totalsDict["tipCents"] as? Int ?? 0,
            surchargeCents: totalsDict["surchargeCents"] as? Int ?? 0,
            totalCents: totalsDict["totalCents"] as? Int ?? 0,
            paymentMethod: totalsDict["paymentMethod"] as? String,
            cardLastFour: totalsDict["cardLastFour"] as? String
        )

        let footer = params["footer"] as? String
        let openDrawer = params["openDrawer"] as? Bool ?? false

        printerManager.printReceipt(
            header: header,
            items: items,
            totals: totals,
            footer: footer,
            openDrawer: openDrawer
        )
    }

    // MARK: - Send Callback to JavaScript

    /// Send an event + data payload to the web view via evaluateJavaScript
    func sendCallback(event: String, data: [String: Any]) {
        guard let webView else {
            logger.warning("No web view attached — cannot send callback")
            return
        }

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
            guard let jsonString = String(data: jsonData, encoding: .utf8) else { return }

            // Escape for JavaScript string literal
            let escapedJSON = jsonString
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")

            let js = "if(window.posNativeCallback){window.posNativeCallback('\(event)',JSON.parse('\(escapedJSON)'))}"

            webView.evaluateJavaScript(js) { [weak self] _, error in
                if let error {
                    self?.logger.error("JS callback error: \(error.localizedDescription)")
                }
            }
        } catch {
            logger.error("JSON serialization error: \(error.localizedDescription)")
        }
    }
}

// MARK: - BluetoothManagerDelegate

extension NativeBridge: BluetoothManagerDelegate {
    nonisolated func bluetoothManagerDidUpdateState(_ manager: BluetoothManager, poweredOn: Bool) {
        Task { @MainActor [weak self] in
            self?.sendCallback(event: "bluetoothState", data: ["poweredOn": poweredOn])
        }
    }

    nonisolated func bluetoothManagerDidDiscoverReaders(_ manager: BluetoothManager, readers: [DiscoveredReader]) {
        Task { @MainActor [weak self] in
            let readersData = readers.map { reader -> [String: Any] in
                [
                    "identifier": reader.identifier,
                    "name": reader.name,
                    "rssi": reader.rssi
                ]
            }
            self?.sendCallback(event: "readersDiscovered", data: ["readers": readersData])
        }
    }

    nonisolated func bluetoothManagerDidConnect(_ manager: BluetoothManager, readerIdentifier: String) {
        Task { @MainActor [weak self] in
            self?.sendCallback(event: "readerConnected", data: [
                "identifier": readerIdentifier,
                "status": "connected"
            ])
        }
    }

    nonisolated func bluetoothManagerDidDisconnect(_ manager: BluetoothManager, readerIdentifier: String, error: (any Error)?) {
        Task { @MainActor [weak self] in
            var data: [String: Any] = [
                "identifier": readerIdentifier,
                "status": "disconnected"
            ]
            if let error {
                data["error"] = error.localizedDescription
            }
            self?.sendCallback(event: "readerDisconnected", data: data)
        }
    }

    nonisolated func bluetoothManagerDidReceivePaymentResponse(_ manager: BluetoothManager, data: [String: Any]) {
        Task { @MainActor [weak self] in
            let success = data["success"] as? Bool ?? false
            let event = success ? "paymentComplete" : "paymentFailed"
            self?.sendCallback(event: event, data: data)
        }
    }

    nonisolated func bluetoothManagerDidFailConnection(_ manager: BluetoothManager, error: any Error) {
        Task { @MainActor [weak self] in
            self?.sendCallback(event: "readerConnectionFailed", data: [
                "error": error.localizedDescription
            ])
        }
    }
}

// MARK: - PrinterManagerDelegate

extension NativeBridge: PrinterManagerDelegate {
    nonisolated func printerManagerDidDiscoverPrinters(_ manager: PrinterManager, printers: [DiscoveredPrinter]) {
        Task { @MainActor [weak self] in
            let printersData = printers.map { printer -> [String: Any] in
                [
                    "identifier": printer.identifier,
                    "name": printer.name,
                    "rssi": printer.rssi,
                    "connectionType": printer.connectionType.rawValue
                ]
            }
            self?.sendCallback(event: "printersDiscovered", data: ["printers": printersData])
        }
    }

    nonisolated func printerManagerDidConnect(_ manager: PrinterManager, printerIdentifier: String) {
        Task { @MainActor [weak self] in
            self?.sendCallback(event: "printerConnected", data: [
                "identifier": printerIdentifier,
                "status": "connected"
            ])
        }
    }

    nonisolated func printerManagerDidDisconnect(_ manager: PrinterManager, printerIdentifier: String) {
        Task { @MainActor [weak self] in
            self?.sendCallback(event: "printerDisconnected", data: [
                "identifier": printerIdentifier,
                "status": "disconnected"
            ])
        }
    }

    nonisolated func printerManagerDidCompletePrint(_ manager: PrinterManager, success: Bool, error: (any Error)?) {
        Task { @MainActor [weak self] in
            var data: [String: Any] = ["success": success]
            if let error {
                data["error"] = error.localizedDescription
            }
            self?.sendCallback(event: "printComplete", data: data)
        }
    }

    nonisolated func printerManagerDidOpenDrawer(_ manager: PrinterManager, success: Bool) {
        Task { @MainActor [weak self] in
            self?.sendCallback(event: "drawerOpened", data: ["success": success])
        }
    }
}
