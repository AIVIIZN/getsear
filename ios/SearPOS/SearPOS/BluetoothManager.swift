import CoreBluetooth
import Foundation
import os

// MARK: - Valor RCKT BLE UUIDs
// TODO: Replace these placeholder UUIDs with actual Valor RCKT service/characteristic UUIDs
// once ISV credentials are received from Valor PayTech. The RCKT terminal advertises
// a custom BLE service for payment communication. Contact Valor ISV support for the
// BLE integration guide which documents:
//   1. The primary service UUID the terminal advertises
//   2. The write characteristic UUID (iPad -> terminal commands)
//   3. The notify characteristic UUID (terminal -> iPad responses)
//   4. The command protocol format (header, length, payload, checksum)
private let valorServiceUUID = CBUUID(string: "0000FFF0-0000-1000-8000-00805F9B34FB")
private let valorWriteCharUUID = CBUUID(string: "0000FFF1-0000-1000-8000-00805F9B34FB")
private let valorNotifyCharUUID = CBUUID(string: "0000FFF2-0000-1000-8000-00805F9B34FB")

// Valor RCKT advertised local name prefix (verify against actual hardware)
private let valorNamePrefix = "VALOR"

/// Connection state for a Bluetooth peripheral
enum ReaderConnectionState: String, Sendable {
    case disconnected
    case connecting
    case connected
    case error
}

/// Represents a discovered Valor payment reader
struct DiscoveredReader: Sendable {
    let identifier: String
    let name: String
    let rssi: Int
}

/// Delegate protocol for BluetoothManager events — called on MainActor
@MainActor
protocol BluetoothManagerDelegate: AnyObject {
    func bluetoothManagerDidUpdateState(_ manager: BluetoothManager, poweredOn: Bool)
    func bluetoothManagerDidDiscoverReaders(_ manager: BluetoothManager, readers: [DiscoveredReader])
    func bluetoothManagerDidConnect(_ manager: BluetoothManager, readerIdentifier: String)
    func bluetoothManagerDidDisconnect(_ manager: BluetoothManager, readerIdentifier: String, error: (any Error)?)
    func bluetoothManagerDidReceivePaymentResponse(_ manager: BluetoothManager, data: [String: Any])
    func bluetoothManagerDidFailConnection(_ manager: BluetoothManager, error: any Error)
}

final class BluetoothManager: NSObject, @unchecked Sendable {
    private let logger = Logger(subsystem: "com.getsear.pos", category: "Bluetooth")

    private var centralManager: CBCentralManager!
    private let bleQueue = DispatchQueue(label: "com.getsear.pos.ble", qos: .userInitiated)

    private var discoveredPeripherals: [String: CBPeripheral] = [:]
    private var discoveredReadersInfo: [DiscoveredReader] = []
    private var connectedPeripheral: CBPeripheral?
    private var writeCharacteristic: CBCharacteristic?
    private var notifyCharacteristic: CBCharacteristic?

    private(set) var connectionState: ReaderConnectionState = .disconnected
    private var autoReconnectIdentifier: String?
    private var scanTimer: Timer?

    // Response accumulation buffer for multi-packet responses
    private var responseBuffer = Data()

    @MainActor weak var delegate: BluetoothManagerDelegate?

    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: bleQueue, options: [
            CBCentralManagerOptionShowPowerAlertKey: true,
            CBCentralManagerOptionRestoreIdentifierKey: "com.getsear.pos.central"
        ])
    }

    // MARK: - Public API

    /// Start scanning for Valor RCKT payment terminals
    func scanForReaders() {
        guard centralManager.state == .poweredOn else {
            logger.warning("Cannot scan — Bluetooth not powered on (state: \(self.centralManager.state.rawValue))")
            return
        }

        stopScanning()
        discoveredPeripherals.removeAll()
        discoveredReadersInfo.removeAll()

        logger.info("Scanning for Valor RCKT readers...")
        centralManager.scanForPeripherals(
            withServices: [valorServiceUUID],
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )

        // Also scan without service filter to catch readers that may not advertise the service UUID
        // in their advertisement packet (some BLE devices only expose services after connection)
        centralManager.scanForPeripherals(
            withServices: nil,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )

        // Auto-stop scan after 10 seconds
        DispatchQueue.main.async { [weak self] in
            self?.scanTimer?.invalidate()
            self?.scanTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: false) { [weak self] _ in
                self?.stopScanning()
            }
        }
    }

    /// Stop scanning for peripherals
    func stopScanning() {
        if centralManager.isScanning {
            centralManager.stopScan()
            logger.info("Stopped BLE scan")
        }
        DispatchQueue.main.async { [weak self] in
            self?.scanTimer?.invalidate()
            self?.scanTimer = nil
        }
    }

    /// Connect to a discovered reader by its identifier (UUID string)
    func connect(identifier: String) {
        guard let peripheral = discoveredPeripherals[identifier] else {
            logger.error("No discovered peripheral with identifier: \(identifier)")
            let error = NSError(domain: "com.getsear.pos", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Reader not found. Try scanning again."
            ])
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.delegate?.bluetoothManagerDidFailConnection(self, error: error)
            }
            return
        }

        stopScanning()
        connectionState = .connecting
        autoReconnectIdentifier = identifier

        logger.info("Connecting to reader: \(peripheral.name ?? "Unknown") (\(identifier))")
        centralManager.connect(peripheral, options: [
            CBConnectPeripheralOptionNotifyOnConnectionKey: true,
            CBConnectPeripheralOptionNotifyOnDisconnectionKey: true
        ])
    }

    /// Disconnect from the currently connected reader
    func disconnect() {
        autoReconnectIdentifier = nil
        if let peripheral = connectedPeripheral {
            centralManager.cancelPeripheralConnection(peripheral)
        }
        connectionState = .disconnected
    }

    /// Send a payment command to the connected Valor RCKT terminal.
    /// The command format follows the Valor BLE protocol:
    /// [STX(0x02)] [Length(2 bytes)] [Command(1 byte)] [Payload(variable)] [LRC(1 byte)] [ETX(0x03)]
    ///
    /// TODO: Replace this with actual Valor RCKT command protocol once ISV docs are received.
    /// The payment flow is typically:
    ///   1. Send sale command with amount
    ///   2. Terminal displays amount and prompts for card
    ///   3. Terminal processes card and returns approval/decline
    ///   4. iPad receives response via notify characteristic
    func sendPaymentRequest(amountInCents: Int, orderId: String) {
        guard connectionState == .connected, let characteristic = writeCharacteristic else {
            logger.error("Cannot send payment — reader not connected or write characteristic not found")
            let response: [String: Any] = [
                "success": false,
                "error": "Reader not connected"
            ]
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.delegate?.bluetoothManagerDidReceivePaymentResponse(self, data: response)
            }
            return
        }

        // Build Valor payment command
        // TODO: Replace with actual Valor RCKT sale command format from ISV documentation
        let command = buildSaleCommand(amountInCents: amountInCents, orderId: orderId)

        responseBuffer = Data()
        connectedPeripheral?.writeValue(command, for: characteristic, type: .withResponse)
        logger.info("Sent payment request: \(amountInCents) cents for order \(orderId)")
    }

    /// Get current reader status information
    func getReaderStatus() -> [String: Any] {
        var status: [String: Any] = [
            "connectionState": connectionState.rawValue,
            "bluetoothPoweredOn": centralManager.state == .poweredOn
        ]
        if let peripheral = connectedPeripheral {
            status["readerName"] = peripheral.name ?? "Unknown"
            status["readerIdentifier"] = peripheral.identifier.uuidString
        }
        return status
    }

    // MARK: - Command Building

    /// Build a sale command for the Valor RCKT terminal.
    /// TODO: This is a placeholder format. Replace with actual Valor BLE protocol:
    ///   - STX byte
    ///   - Command type (sale = 0x01, void = 0x02, refund = 0x03, etc.)
    ///   - Amount as BCD or ASCII depending on protocol version
    ///   - Reference/order ID
    ///   - LRC checksum
    ///   - ETX byte
    private func buildSaleCommand(amountInCents: Int, orderId: String) -> Data {
        var command = Data()

        // STX
        command.append(0x02)

        // Command: Sale
        command.append(0x01)

        // Amount: 8 bytes ASCII, zero-padded (e.g., "00001299" for $12.99)
        let amountString = String(format: "%08d", amountInCents)
        if let amountData = amountString.data(using: .ascii) {
            command.append(amountData)
        }

        // Order ID: variable length, null-terminated
        if let orderData = orderId.data(using: .ascii) {
            command.append(orderData)
        }
        command.append(0x00) // null terminator

        // LRC (Longitudinal Redundancy Check): XOR of all bytes between STX and ETX
        var lrc: UInt8 = 0
        for i in 1..<command.count {
            lrc ^= command[i]
        }
        command.append(lrc)

        // ETX
        command.append(0x03)

        return command
    }

    /// Parse a payment response from the Valor RCKT terminal.
    /// TODO: Replace with actual Valor response parsing once ISV docs are received.
    /// Expected response format:
    ///   [STX] [Response Code(2 bytes)] [Auth Code(6 bytes)] [Card Last Four(4 bytes)]
    ///   [Card Type(2 bytes)] [Additional TLV data] [LRC] [ETX]
    private func parsePaymentResponse(_ data: Data) -> [String: Any] {
        guard data.count >= 6 else {
            return ["success": false, "error": "Invalid response (too short)"]
        }

        // Verify framing
        guard data.first == 0x02, data.last == 0x03 else {
            return ["success": false, "error": "Invalid response framing"]
        }

        // Verify LRC
        let payloadEnd = data.count - 2 // last byte before ETX is LRC
        var expectedLRC: UInt8 = 0
        for i in 1..<payloadEnd {
            expectedLRC ^= data[i]
        }
        guard data[payloadEnd] == expectedLRC else {
            return ["success": false, "error": "Checksum mismatch"]
        }

        // Parse response fields
        // TODO: Map actual Valor response codes to approval/decline
        let responseCode = String(data: data.subdata(in: 1..<3), encoding: .ascii) ?? "??"
        let approved = responseCode == "00" || responseCode == "AP"

        var result: [String: Any] = [
            "success": approved,
            "responseCode": responseCode
        ]

        if approved && data.count >= 15 {
            let authCode = String(data: data.subdata(in: 3..<9), encoding: .ascii) ?? ""
            let lastFour = String(data: data.subdata(in: 9..<13), encoding: .ascii) ?? ""
            let cardType = String(data: data.subdata(in: 13..<15), encoding: .ascii) ?? ""

            result["authCode"] = authCode.trimmingCharacters(in: .whitespaces)
            result["lastFour"] = lastFour
            result["cardType"] = cardType.trimmingCharacters(in: .whitespaces)
        } else if !approved {
            result["error"] = "Payment declined (code: \(responseCode))"
        }

        return result
    }
}

// MARK: - CBCentralManagerDelegate

extension BluetoothManager: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        let poweredOn = central.state == .poweredOn
        logger.info("Bluetooth state changed: \(central.state.rawValue) (poweredOn: \(poweredOn))")

        Task { @MainActor [weak self] in
            guard let self else { return }
            self.delegate?.bluetoothManagerDidUpdateState(self, poweredOn: poweredOn)
        }

        // Auto-reconnect if we had a connected reader and Bluetooth toggled off/on
        if poweredOn, let identifier = autoReconnectIdentifier {
            let uuid = UUID(uuidString: identifier)
            if let uuid {
                let known = central.retrievePeripherals(withIdentifiers: [uuid])
                if let peripheral = known.first {
                    discoveredPeripherals[identifier] = peripheral
                    connect(identifier: identifier)
                }
            }
        }
    }

    func centralManager(
        _ central: CBCentralManager,
        willRestoreState dict: [String: Any]
    ) {
        // State restoration for background Bluetooth
        if let peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] {
            for peripheral in peripherals {
                let id = peripheral.identifier.uuidString
                discoveredPeripherals[id] = peripheral
                peripheral.delegate = self
                if peripheral.state == .connected {
                    connectedPeripheral = peripheral
                    connectionState = .connected
                    autoReconnectIdentifier = id
                }
            }
        }
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

        // Filter: only accept peripherals that look like Valor readers
        // Check for service UUID in advertisement OR name prefix match
        let advertisedServices = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] ?? []
        let hasValorService = advertisedServices.contains(valorServiceUUID)
        let hasValorName = name.uppercased().hasPrefix(valorNamePrefix)

        guard hasValorService || hasValorName else { return }

        let identifier = peripheral.identifier.uuidString

        if discoveredPeripherals[identifier] == nil {
            logger.info("Discovered reader: \(name) (\(identifier)) RSSI: \(RSSI.intValue)")
        }

        discoveredPeripherals[identifier] = peripheral

        let reader = DiscoveredReader(
            identifier: identifier,
            name: name,
            rssi: RSSI.intValue
        )

        // Update or add to discovered list
        if let index = discoveredReadersInfo.firstIndex(where: { $0.identifier == identifier }) {
            discoveredReadersInfo[index] = reader
        } else {
            discoveredReadersInfo.append(reader)
        }

        Task { @MainActor [weak self] in
            guard let self else { return }
            self.delegate?.bluetoothManagerDidDiscoverReaders(self, readers: self.discoveredReadersInfo)
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        logger.info("Connected to: \(peripheral.name ?? "Unknown")")
        connectedPeripheral = peripheral
        peripheral.delegate = self
        peripheral.discoverServices([valorServiceUUID])
    }

    func centralManager(
        _ central: CBCentralManager,
        didFailToConnect peripheral: CBPeripheral,
        error: (any Error)?
    ) {
        let err = error ?? NSError(domain: "com.getsear.pos", code: 2, userInfo: [
            NSLocalizedDescriptionKey: "Failed to connect to reader"
        ])
        logger.error("Failed to connect: \(err.localizedDescription)")
        connectionState = .error

        Task { @MainActor [weak self] in
            guard let self else { return }
            self.delegate?.bluetoothManagerDidFailConnection(self, error: err)
        }

        // Attempt auto-reconnect after delay
        if autoReconnectIdentifier != nil {
            bleQueue.asyncAfter(deadline: .now() + 3.0) { [weak self] in
                guard let self, let id = self.autoReconnectIdentifier else { return }
                self.connect(identifier: id)
            }
        }
    }

    func centralManager(
        _ central: CBCentralManager,
        didDisconnectPeripheral peripheral: CBPeripheral,
        error: (any Error)?
    ) {
        let identifier = peripheral.identifier.uuidString
        logger.info("Disconnected from: \(peripheral.name ?? "Unknown") (error: \(error?.localizedDescription ?? "none"))")

        connectedPeripheral = nil
        writeCharacteristic = nil
        notifyCharacteristic = nil
        connectionState = .disconnected

        Task { @MainActor [weak self] in
            guard let self else { return }
            self.delegate?.bluetoothManagerDidDisconnect(self, readerIdentifier: identifier, error: error)
        }

        // Auto-reconnect if this was an unexpected disconnect
        if let reconnectId = autoReconnectIdentifier, reconnectId == identifier {
            logger.info("Attempting auto-reconnect in 2 seconds...")
            bleQueue.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                guard let self, self.autoReconnectIdentifier != nil else { return }
                self.connect(identifier: reconnectId)
            }
        }
    }
}

// MARK: - CBPeripheralDelegate

extension BluetoothManager: CBPeripheralDelegate {
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: (any Error)?) {
        if let error {
            logger.error("Service discovery error: \(error.localizedDescription)")
            return
        }

        guard let services = peripheral.services else { return }

        for service in services {
            if service.uuid == valorServiceUUID {
                logger.info("Found Valor service, discovering characteristics...")
                peripheral.discoverCharacteristics(
                    [valorWriteCharUUID, valorNotifyCharUUID],
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
        if let error {
            logger.error("Characteristic discovery error: \(error.localizedDescription)")
            return
        }

        guard let characteristics = service.characteristics else { return }

        for characteristic in characteristics {
            switch characteristic.uuid {
            case valorWriteCharUUID:
                writeCharacteristic = characteristic
                logger.info("Found write characteristic")

            case valorNotifyCharUUID:
                notifyCharacteristic = characteristic
                peripheral.setNotifyValue(true, for: characteristic)
                logger.info("Found notify characteristic, subscribed to notifications")

            default:
                break
            }
        }

        // If we have both characteristics, we're fully connected and ready
        if writeCharacteristic != nil && notifyCharacteristic != nil {
            connectionState = .connected
            let identifier = peripheral.identifier.uuidString

            Task { @MainActor [weak self] in
                guard let self else { return }
                self.delegate?.bluetoothManagerDidConnect(self, readerIdentifier: identifier)
            }
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: (any Error)?
    ) {
        if let error {
            logger.error("Characteristic update error: \(error.localizedDescription)")
            return
        }

        guard characteristic.uuid == valorNotifyCharUUID, let value = characteristic.value else {
            return
        }

        // Accumulate response data — the terminal may send multi-packet responses
        responseBuffer.append(value)

        // Check if we have a complete response (ends with ETX byte 0x03)
        if responseBuffer.last == 0x03 {
            let completeResponse = responseBuffer
            responseBuffer = Data()

            let parsed = parsePaymentResponse(completeResponse)
            logger.info("Payment response received: \(parsed["success"] as? Bool ?? false)")

            Task { @MainActor [weak self] in
                guard let self else { return }
                self.delegate?.bluetoothManagerDidReceivePaymentResponse(self, data: parsed)
            }
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didWriteValueFor characteristic: CBCharacteristic,
        error: (any Error)?
    ) {
        if let error {
            logger.error("Write error: \(error.localizedDescription)")
            let response: [String: Any] = [
                "success": false,
                "error": "Failed to send command: \(error.localizedDescription)"
            ]
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.delegate?.bluetoothManagerDidReceivePaymentResponse(self, data: response)
            }
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateNotificationStateFor characteristic: CBCharacteristic,
        error: (any Error)?
    ) {
        if let error {
            logger.error("Notification state error: \(error.localizedDescription)")
        } else {
            logger.info("Notification state updated for \(characteristic.uuid): \(characteristic.isNotifying)")
        }
    }
}
