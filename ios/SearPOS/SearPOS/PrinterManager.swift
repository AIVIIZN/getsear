import CoreBluetooth
import Foundation
import Network
import os

// Star Micronics Bluetooth printers (SM-L200, SM-T300i, TSP100IV) use the standard
// Serial Port Profile (SPP) over Bluetooth Classic, or BLE with a custom service.
// For BLE-capable Star printers, these are the known service/characteristic UUIDs:
private let starPrinterServiceUUID = CBUUID(string: "49535343-FE7D-4AE5-8FA9-9FAFD205E455")
private let starPrinterWriteCharUUID = CBUUID(string: "49535343-8841-43F4-A8D4-ECBE34729BB3")
private let starPrinterStatusCharUUID = CBUUID(string: "49535343-1E4D-4BD9-BA61-23C647249616")

private let starNamePrefixes = ["Star", "TSP", "SM-", "mC-Print", "mPOP"]

/// Represents a discovered printer
struct DiscoveredPrinter: Sendable {
    let identifier: String
    let name: String
    let rssi: Int
    let connectionType: PrinterConnectionType
}

enum PrinterConnectionType: String, Sendable {
    case bluetooth
    case network
}

/// Delegate for printer events
@MainActor
protocol PrinterManagerDelegate: AnyObject {
    func printerManagerDidDiscoverPrinters(_ manager: PrinterManager, printers: [DiscoveredPrinter])
    func printerManagerDidConnect(_ manager: PrinterManager, printerIdentifier: String)
    func printerManagerDidDisconnect(_ manager: PrinterManager, printerIdentifier: String)
    func printerManagerDidCompletePrint(_ manager: PrinterManager, success: Bool, error: (any Error)?)
    func printerManagerDidOpenDrawer(_ manager: PrinterManager, success: Bool)
}

final class PrinterManager: NSObject, @unchecked Sendable {
    private let logger = Logger(subsystem: "com.getsear.pos", category: "Printer")

    // BLE
    private var centralManager: CBCentralManager!
    private let bleQueue = DispatchQueue(label: "com.getsear.pos.printer.ble", qos: .userInitiated)
    private var discoveredPeripherals: [String: CBPeripheral] = [:]
    private var discoveredPrintersInfo: [DiscoveredPrinter] = []
    private var connectedPeripheral: CBPeripheral?
    private var writeCharacteristic: CBCharacteristic?
    private var printQueue: [Data] = []
    private var isSending = false

    // Network (TCP) fallback for Star printers on LAN
    private var networkConnection: NWConnection?
    private var networkPrinterEndpoint: NWEndpoint?
    private var activeConnectionType: PrinterConnectionType?

    // Chunk size for BLE writes — most BLE peripherals support 20 bytes per write,
    // but negotiated MTU may allow more. Start conservative.
    private var bleChunkSize = 20

    @MainActor weak var delegate: PrinterManagerDelegate?

    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: bleQueue, options: [
            CBCentralManagerOptionShowPowerAlertKey: false
        ])
    }

    // MARK: - Discovery

    /// Scan for Star Micronics printers via BLE
    func scanForPrinters() {
        guard centralManager.state == .poweredOn else {
            logger.warning("Cannot scan for printers — Bluetooth not powered on")
            return
        }

        discoveredPeripherals.removeAll()
        discoveredPrintersInfo.removeAll()

        logger.info("Scanning for Star printers via BLE...")
        centralManager.scanForPeripherals(
            withServices: [starPrinterServiceUUID],
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )

        // Also do a broad scan for printers that might not advertise the Star service UUID
        centralManager.scanForPeripherals(
            withServices: nil,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )

        // Stop after 8 seconds
        bleQueue.asyncAfter(deadline: .now() + 8.0) { [weak self] in
            self?.stopScanning()
        }
    }

    /// Stop BLE scanning
    func stopScanning() {
        if centralManager.isScanning {
            centralManager.stopScan()
            logger.info("Stopped printer BLE scan")
        }
    }

    // MARK: - Connection

    /// Connect to a printer by identifier (BLE UUID string)
    func connectBluetooth(identifier: String) {
        guard let peripheral = discoveredPeripherals[identifier] else {
            logger.error("Printer not found: \(identifier)")
            return
        }

        stopScanning()
        logger.info("Connecting to printer: \(peripheral.name ?? "Unknown")")
        centralManager.connect(peripheral, options: nil)
    }

    /// Connect to a printer via TCP (for Star printers on local network)
    /// Standard Star Micronics TCP port is 9100
    func connectNetwork(host: String, port: UInt16 = 9100) {
        let endpoint = NWEndpoint.hostPort(
            host: NWEndpoint.Host(host),
            port: NWEndpoint.Port(rawValue: port)!
        )
        networkPrinterEndpoint = endpoint

        let connection = NWConnection(to: endpoint, using: .tcp)
        connection.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                self.logger.info("Network printer connected: \(host):\(port)")
                self.activeConnectionType = .network
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    self.delegate?.printerManagerDidConnect(self, printerIdentifier: "\(host):\(port)")
                }
            case .failed(let error):
                self.logger.error("Network printer connection failed: \(error.localizedDescription)")
                self.networkConnection = nil
                self.activeConnectionType = nil
            case .cancelled:
                self.logger.info("Network printer connection cancelled")
                self.networkConnection = nil
                self.activeConnectionType = nil
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    self.delegate?.printerManagerDidDisconnect(self, printerIdentifier: "\(host):\(port)")
                }
            default:
                break
            }
        }

        networkConnection = connection
        connection.start(queue: bleQueue)
    }

    /// Disconnect from the current printer
    func disconnect() {
        if let peripheral = connectedPeripheral {
            centralManager.cancelPeripheralConnection(peripheral)
        }
        networkConnection?.cancel()
        networkConnection = nil
        activeConnectionType = nil
        connectedPeripheral = nil
        writeCharacteristic = nil
    }

    // MARK: - Printing

    /// Print receipt data (raw ESC/POS bytes)
    func printData(_ data: Data) {
        switch activeConnectionType {
        case .bluetooth:
            printViaBluetooth(data)
        case .network:
            printViaNetwork(data)
        case nil:
            logger.error("No printer connected")
            Task { @MainActor [weak self] in
                guard let self else { return }
                let error = NSError(domain: "com.getsear.pos", code: 10, userInfo: [
                    NSLocalizedDescriptionKey: "No printer connected"
                ])
                self.delegate?.printerManagerDidCompletePrint(self, success: false, error: error)
            }
        }
    }

    /// Print a receipt from structured data
    func printReceipt(
        header: ReceiptHeader,
        items: [ReceiptItem],
        totals: ReceiptTotals,
        footer: String? = nil,
        openDrawer: Bool = false
    ) {
        let data = ESCPOSBuilder.buildReceipt(
            header: header,
            items: items,
            totals: totals,
            footer: footer,
            openDrawer: openDrawer
        )
        printData(data)
    }

    /// Print receipt from HTML (basic conversion to ESC/POS)
    /// Supports: <b>, <center>, <right>, <br>, <hr>, <h1>-<h3>, plain text
    func printReceiptFromHTML(_ html: String) {
        let data = convertHTMLToESCPOS(html)
        printData(data)
    }

    /// Open the cash drawer via the printer's kick connector
    func openCashDrawer() {
        let builder = ESCPOSBuilder()
        builder.initialize().openCashDrawer(pin: 0)
        let data = builder.build()

        switch activeConnectionType {
        case .bluetooth:
            printViaBluetooth(data)
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.delegate?.printerManagerDidOpenDrawer(self, success: true)
            }
        case .network:
            printViaNetwork(data)
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.delegate?.printerManagerDidOpenDrawer(self, success: true)
            }
        case nil:
            logger.error("Cannot open drawer — no printer connected")
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.delegate?.printerManagerDidOpenDrawer(self, success: false)
            }
        }
    }

    // MARK: - Bluetooth Print

    private func printViaBluetooth(_ data: Data) {
        guard let characteristic = writeCharacteristic, let peripheral = connectedPeripheral else {
            logger.error("BLE printer not ready — no write characteristic")
            Task { @MainActor [weak self] in
                guard let self else { return }
                let error = NSError(domain: "com.getsear.pos", code: 11, userInfo: [
                    NSLocalizedDescriptionKey: "Printer not ready"
                ])
                self.delegate?.printerManagerDidCompletePrint(self, success: false, error: error)
            }
            return
        }

        // Split data into BLE-sized chunks
        var chunks: [Data] = []
        var offset = 0
        while offset < data.count {
            let end = min(offset + bleChunkSize, data.count)
            chunks.append(data.subdata(in: offset..<end))
            offset = end
        }

        // Queue chunks and send sequentially
        printQueue = chunks
        isSending = true
        sendNextChunk(peripheral: peripheral, characteristic: characteristic)
    }

    private func sendNextChunk(peripheral: CBPeripheral, characteristic: CBCharacteristic) {
        guard !printQueue.isEmpty else {
            isSending = false
            logger.info("Print job complete (BLE)")
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.delegate?.printerManagerDidCompletePrint(self, success: true, error: nil)
            }
            return
        }

        let chunk = printQueue.removeFirst()

        // Use .withResponse to get write confirmation and pace the transfer
        if characteristic.properties.contains(.write) {
            peripheral.writeValue(chunk, for: characteristic, type: .withResponse)
        } else {
            // Fallback to .withoutResponse with a small delay between chunks
            peripheral.writeValue(chunk, for: characteristic, type: .withoutResponse)
            bleQueue.asyncAfter(deadline: .now() + 0.02) { [weak self] in
                self?.sendNextChunk(peripheral: peripheral, characteristic: characteristic)
            }
        }
    }

    // MARK: - Network Print

    private func printViaNetwork(_ data: Data) {
        guard let connection = networkConnection else {
            logger.error("No network printer connection")
            return
        }

        connection.send(content: data, completion: .contentProcessed { [weak self] error in
            guard let self else { return }
            if let error {
                self.logger.error("Network print error: \(error.localizedDescription)")
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    self.delegate?.printerManagerDidCompletePrint(self, success: false, error: error)
                }
            } else {
                self.logger.info("Print job complete (network)")
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    self.delegate?.printerManagerDidCompletePrint(self, success: true, error: nil)
                }
            }
        })
    }

    // MARK: - HTML to ESC/POS Conversion

    /// Convert basic HTML to ESC/POS commands.
    /// Supports a limited subset: <b>, <center>, <right>, <br>, <hr>, <h1>-<h3>, <p>, text nodes.
    private func convertHTMLToESCPOS(_ html: String) -> Data {
        let builder = ESCPOSBuilder()
        builder.initialize()

        // Simple tag-based parser (not a full HTML parser — handles receipt-level markup)
        var remaining = html
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")

        while !remaining.isEmpty {
            if remaining.hasPrefix("<") {
                // Find closing >
                guard let closeIndex = remaining.firstIndex(of: ">") else {
                    // Malformed — dump rest as text
                    builder.printText(remaining)
                    break
                }

                let tag = String(remaining[remaining.startIndex...closeIndex]).lowercased()
                remaining = String(remaining[remaining.index(after: closeIndex)...])

                switch tag {
                case "<b>":
                    builder.boldOn()
                case "</b>":
                    builder.boldOff()
                case "<center>":
                    builder.alignCenter()
                case "</center>":
                    builder.alignLeft()
                case "<right>":
                    builder.alignRight()
                case "</right>":
                    builder.alignLeft()
                case "<br>", "<br/>", "<br />":
                    builder.printLine("")
                case "<hr>", "<hr/>", "<hr />":
                    builder.printSeparator()
                case "<h1>":
                    builder.textSizeDouble().boldOn().alignCenter()
                case "</h1>":
                    builder.textSizeNormal().boldOff().alignLeft()
                case "<h2>":
                    builder.textSizeDoubleHeight().boldOn()
                case "</h2>":
                    builder.textSizeNormal().boldOff()
                case "<h3>":
                    builder.boldOn()
                case "</h3>":
                    builder.boldOff()
                case "<p>":
                    break // no-op, just continue
                case "</p>":
                    builder.printLine("")
                case "<cut>", "<cut/>":
                    builder.feedAndCut()
                case "<drawer>", "<drawer/>":
                    builder.openCashDrawer()
                default:
                    // Skip unknown tags
                    break
                }
            } else {
                // Text node — read until next tag or end
                let nextTag = remaining.firstIndex(of: "<") ?? remaining.endIndex
                let text = String(remaining[remaining.startIndex..<nextTag])
                remaining = String(remaining[nextTag...])

                // Decode basic HTML entities
                let decoded = text
                    .replacingOccurrences(of: "&amp;", with: "&")
                    .replacingOccurrences(of: "&lt;", with: "<")
                    .replacingOccurrences(of: "&gt;", with: ">")
                    .replacingOccurrences(of: "&nbsp;", with: " ")
                    .replacingOccurrences(of: "&#39;", with: "'")
                    .replacingOccurrences(of: "&quot;", with: "\"")

                if !decoded.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    // Split by newlines
                    let lines = decoded.components(separatedBy: "\n")
                    for (i, line) in lines.enumerated() {
                        let trimmed = line.trimmingCharacters(in: .init(charactersIn: "\r"))
                        if !trimmed.isEmpty {
                            builder.printText(trimmed)
                        }
                        if i < lines.count - 1 {
                            builder.printLine("")
                        }
                    }
                }
            }
        }

        // Always end with feed and cut
        builder.feedAndCut(feedLines: 4)

        return builder.build()
    }
}

// MARK: - CBCentralManagerDelegate

extension PrinterManager: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        logger.info("Printer BLE state: \(central.state.rawValue)")
    }

    func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let name = peripheral.name
            ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
            ?? "Unknown"

        // Filter for Star printers
        let advertisedServices = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] ?? []
        let hasStarService = advertisedServices.contains(starPrinterServiceUUID)
        let hasStarName = starNamePrefixes.contains { name.hasPrefix($0) }

        guard hasStarService || hasStarName else { return }

        let identifier = peripheral.identifier.uuidString
        discoveredPeripherals[identifier] = peripheral

        let printer = DiscoveredPrinter(
            identifier: identifier,
            name: name,
            rssi: RSSI.intValue,
            connectionType: .bluetooth
        )

        if let index = discoveredPrintersInfo.firstIndex(where: { $0.identifier == identifier }) {
            discoveredPrintersInfo[index] = printer
        } else {
            discoveredPrintersInfo.append(printer)
            logger.info("Discovered printer: \(name) (\(identifier))")
        }

        Task { @MainActor [weak self] in
            guard let self else { return }
            self.delegate?.printerManagerDidDiscoverPrinters(self, printers: self.discoveredPrintersInfo)
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        logger.info("Printer connected: \(peripheral.name ?? "Unknown")")
        connectedPeripheral = peripheral
        activeConnectionType = .bluetooth
        peripheral.delegate = self
        peripheral.discoverServices([starPrinterServiceUUID])
    }

    func centralManager(
        _ central: CBCentralManager,
        didDisconnectPeripheral peripheral: CBPeripheral,
        error: (any Error)?
    ) {
        let identifier = peripheral.identifier.uuidString
        logger.info("Printer disconnected: \(peripheral.name ?? "Unknown")")
        connectedPeripheral = nil
        writeCharacteristic = nil
        activeConnectionType = nil

        Task { @MainActor [weak self] in
            guard let self else { return }
            self.delegate?.printerManagerDidDisconnect(self, printerIdentifier: identifier)
        }
    }
}

// MARK: - CBPeripheralDelegate

extension PrinterManager: CBPeripheralDelegate {
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: (any Error)?) {
        guard let services = peripheral.services else { return }
        for service in services {
            if service.uuid == starPrinterServiceUUID {
                peripheral.discoverCharacteristics(
                    [starPrinterWriteCharUUID, starPrinterStatusCharUUID],
                    for: service
                )
            }
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: (any Error)?
    ) {
        guard let characteristics = service.characteristics else { return }

        for characteristic in characteristics {
            if characteristic.uuid == starPrinterWriteCharUUID {
                writeCharacteristic = characteristic
                logger.info("Found printer write characteristic")

                // Negotiate MTU for larger writes
                let mtu = peripheral.maximumWriteValueLength(for: .withResponse)
                if mtu > 20 {
                    bleChunkSize = mtu
                    logger.info("Printer BLE MTU: \(mtu) bytes")
                }

                let identifier = peripheral.identifier.uuidString
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    self.delegate?.printerManagerDidConnect(self, printerIdentifier: identifier)
                }
            }

            if characteristic.uuid == starPrinterStatusCharUUID {
                // Subscribe to printer status notifications (paper out, cover open, etc.)
                peripheral.setNotifyValue(true, for: characteristic)
            }
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didWriteValueFor characteristic: CBCharacteristic,
        error: (any Error)?
    ) {
        if let error {
            logger.error("Printer write error: \(error.localizedDescription)")
            printQueue.removeAll()
            isSending = false
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.delegate?.printerManagerDidCompletePrint(self, success: false, error: error)
            }
            return
        }

        // Send next chunk
        if isSending {
            sendNextChunk(peripheral: peripheral, characteristic: characteristic)
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: (any Error)?
    ) {
        // Status characteristic updates (paper out, cover open, etc.)
        if characteristic.uuid == starPrinterStatusCharUUID, let value = characteristic.value {
            logger.info("Printer status update: \(value.map { String(format: "%02X", $0) }.joined())")
            // TODO: Parse Star printer status bytes and surface to the web app
            // Bit 0: cover open, Bit 2: paper near end, Bit 3: paper out, etc.
        }
    }
}
