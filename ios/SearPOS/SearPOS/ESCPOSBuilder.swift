import Foundation

/// Builds ESC/POS byte sequences for thermal receipt printers.
/// Reference: Epson ESC/POS Application Programming Guide (compatible with Star Micronics ESC/POS mode).
final class ESCPOSBuilder: Sendable {
    private var buffer: Data

    init() {
        buffer = Data()
    }

    // MARK: - Printer Control

    /// ESC @ — Initialize/reset printer to default settings
    @discardableResult
    func initialize() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1B, 0x40])
        return self
    }

    // MARK: - Text Alignment

    /// ESC a 0 — Align text left
    @discardableResult
    func alignLeft() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1B, 0x61, 0x00])
        return self
    }

    /// ESC a 1 — Align text center
    @discardableResult
    func alignCenter() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1B, 0x61, 0x01])
        return self
    }

    /// ESC a 2 — Align text right
    @discardableResult
    func alignRight() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1B, 0x61, 0x02])
        return self
    }

    // MARK: - Text Style

    /// ESC E 1 — Enable bold
    @discardableResult
    func boldOn() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1B, 0x45, 0x01])
        return self
    }

    /// ESC E 0 — Disable bold
    @discardableResult
    func boldOff() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1B, 0x45, 0x00])
        return self
    }

    /// ESC - 1 — Enable underline
    @discardableResult
    func underlineOn() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1B, 0x2D, 0x01])
        return self
    }

    /// ESC - 0 — Disable underline
    @discardableResult
    func underlineOff() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1B, 0x2D, 0x00])
        return self
    }

    // MARK: - Text Size

    /// GS ! 0x00 — Normal size (1x width, 1x height)
    @discardableResult
    func textSizeNormal() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1D, 0x21, 0x00])
        return self
    }

    /// GS ! 0x11 — Double size (2x width, 2x height)
    @discardableResult
    func textSizeDouble() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1D, 0x21, 0x11])
        return self
    }

    /// GS ! 0x10 — Double width only (2x width, 1x height)
    @discardableResult
    func textSizeDoubleWidth() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1D, 0x21, 0x10])
        return self
    }

    /// GS ! 0x01 — Double height only (1x width, 2x height)
    @discardableResult
    func textSizeDoubleHeight() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1D, 0x21, 0x01])
        return self
    }

    /// GS ! n — Custom size. Width multiplier (1-8) in high nibble, height multiplier (1-8) in low nibble.
    @discardableResult
    func textSize(width: UInt8, height: UInt8) -> ESCPOSBuilder {
        let w = min(max(width, 1), 8) - 1
        let h = min(max(height, 1), 8) - 1
        buffer.append(contentsOf: [0x1D, 0x21, (w << 4) | h])
        return self
    }

    // MARK: - Printing Text

    /// Print a line of text followed by a newline
    @discardableResult
    func printLine(_ text: String) -> ESCPOSBuilder {
        if let data = text.data(using: .utf8) {
            buffer.append(data)
        }
        buffer.append(contentsOf: [0x0A]) // LF
        return self
    }

    /// Print text without a trailing newline
    @discardableResult
    func printText(_ text: String) -> ESCPOSBuilder {
        if let data = text.data(using: .utf8) {
            buffer.append(data)
        }
        return self
    }

    /// Print a line padded to fill the receipt width (default 48 chars for 80mm paper)
    @discardableResult
    func printColumns(left: String, right: String, width: Int = 48) -> ESCPOSBuilder {
        let padding = max(width - left.count - right.count, 1)
        let line = left + String(repeating: " ", count: padding) + right
        return printLine(line)
    }

    /// Print a horizontal separator line
    @discardableResult
    func printSeparator(char: Character = "-", width: Int = 48) -> ESCPOSBuilder {
        return printLine(String(repeating: char, count: width))
    }

    // MARK: - Feed & Cut

    /// ESC d n — Feed n lines
    @discardableResult
    func feedLines(_ count: Int) -> ESCPOSBuilder {
        let n = UInt8(min(max(count, 0), 255))
        buffer.append(contentsOf: [0x1B, 0x64, n])
        return self
    }

    /// GS V 0 — Full cut
    @discardableResult
    func cutPaper() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1D, 0x56, 0x00])
        return self
    }

    /// GS V 1 — Partial cut
    @discardableResult
    func cutPaperPartial() -> ESCPOSBuilder {
        buffer.append(contentsOf: [0x1D, 0x56, 0x01])
        return self
    }

    /// GS V 66 n — Feed n lines then partial cut (most common for receipts)
    @discardableResult
    func feedAndCut(feedLines lines: Int = 3) -> ESCPOSBuilder {
        let n = UInt8(min(max(lines, 0), 255))
        buffer.append(contentsOf: [0x1D, 0x56, 0x42, n])
        return self
    }

    // MARK: - Cash Drawer

    /// ESC p m t1 t2 — Send kick pulse to cash drawer
    /// pin 0 = drawer kick connector pin 2, pin 1 = connector pin 5
    /// t1 = on time (t1 * 2ms), t2 = off time (t2 * 2ms)
    @discardableResult
    func openCashDrawer(pin: Int = 0) -> ESCPOSBuilder {
        let m: UInt8 = pin == 0 ? 0x00 : 0x01
        // 50 * 2ms = 100ms on, 50 * 2ms = 100ms off — standard kick pulse
        buffer.append(contentsOf: [0x1B, 0x70, m, 0x32, 0x32])
        return self
    }

    // MARK: - Build

    /// Return the accumulated byte buffer
    func build() -> Data {
        return buffer
    }

    /// Reset the buffer (allows reuse)
    func reset() {
        buffer = Data()
    }

    // MARK: - Receipt Templates

    /// Build a complete receipt from structured data
    static func buildReceipt(
        header: ReceiptHeader,
        items: [ReceiptItem],
        totals: ReceiptTotals,
        footer: String?,
        openDrawer: Bool = false
    ) -> Data {
        let builder = ESCPOSBuilder()
        builder.initialize()

        // Cash drawer kick if requested
        if openDrawer {
            builder.openCashDrawer()
        }

        // Header: restaurant name centered, double size
        builder.alignCenter()
            .textSizeDouble()
            .boldOn()
            .printLine(header.restaurantName)
            .boldOff()
            .textSizeNormal()

        // Address and phone
        if let address = header.address {
            builder.printLine(address)
        }
        if let phone = header.phone {
            builder.printLine(phone)
        }

        builder.printLine("")

        // Order info
        if let orderNumber = header.orderNumber {
            builder.alignLeft()
                .boldOn()
                .printLine("Order #\(orderNumber)")
                .boldOff()
        }
        if let orderType = header.orderType {
            builder.printLine("Type: \(orderType)")
        }
        if let server = header.serverName {
            builder.printLine("Server: \(server)")
        }
        builder.printLine("Date: \(header.dateString)")

        // Items
        builder.printSeparator()
            .alignLeft()

        for item in items {
            let qtyName = "\(item.quantity)x \(item.name)"
            let price = formatCents(item.priceInCents * item.quantity)
            builder.printColumns(left: qtyName, right: price)

            // Modifiers
            for modifier in item.modifiers {
                builder.printLine("  + \(modifier)")
            }
        }

        // Totals
        builder.printSeparator()
        builder.printColumns(left: "Subtotal", right: formatCents(totals.subtotalCents))

        if totals.discountCents > 0 {
            builder.printColumns(left: "Discount", right: "-\(formatCents(totals.discountCents))")
        }

        builder.printColumns(left: "Tax", right: formatCents(totals.taxCents))

        if totals.tipCents > 0 {
            builder.printColumns(left: "Tip", right: formatCents(totals.tipCents))
        }

        // Surcharge line for dual pricing
        if totals.surchargeCents > 0 {
            builder.printColumns(left: "Card Surcharge", right: formatCents(totals.surchargeCents))
        }

        builder.printSeparator(char: "=")
            .boldOn()
            .textSizeDoubleHeight()
            .printColumns(left: "TOTAL", right: formatCents(totals.totalCents), width: 48)
            .textSizeNormal()
            .boldOff()

        // Payment method
        if let method = totals.paymentMethod {
            builder.printLine("")
                .printColumns(left: "Paid: \(method)", right: formatCents(totals.totalCents))
        }
        if let lastFour = totals.cardLastFour {
            builder.printLine("Card: ****\(lastFour)")
        }

        // Footer
        builder.printLine("")
            .alignCenter()

        if let footer = footer {
            builder.printLine(footer)
        } else {
            builder.printLine("Thank you!")
        }

        builder.printLine("")
            .feedAndCut(feedLines: 4)

        return builder.build()
    }

    private static func formatCents(_ cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

// MARK: - Receipt Data Models

struct ReceiptHeader: Sendable {
    let restaurantName: String
    let address: String?
    let phone: String?
    let orderNumber: String?
    let orderType: String?
    let serverName: String?
    let dateString: String

    init(
        restaurantName: String,
        address: String? = nil,
        phone: String? = nil,
        orderNumber: String? = nil,
        orderType: String? = nil,
        serverName: String? = nil,
        dateString: String = {
            let f = DateFormatter()
            f.dateFormat = "MM/dd/yyyy hh:mm a"
            return f.string(from: Date())
        }()
    ) {
        self.restaurantName = restaurantName
        self.address = address
        self.phone = phone
        self.orderNumber = orderNumber
        self.orderType = orderType
        self.serverName = serverName
        self.dateString = dateString
    }
}

struct ReceiptItem: Sendable {
    let name: String
    let quantity: Int
    let priceInCents: Int
    let modifiers: [String]

    init(name: String, quantity: Int = 1, priceInCents: Int, modifiers: [String] = []) {
        self.name = name
        self.quantity = quantity
        self.priceInCents = priceInCents
        self.modifiers = modifiers
    }
}

struct ReceiptTotals: Sendable {
    let subtotalCents: Int
    let discountCents: Int
    let taxCents: Int
    let tipCents: Int
    let surchargeCents: Int
    let totalCents: Int
    let paymentMethod: String?
    let cardLastFour: String?

    init(
        subtotalCents: Int,
        discountCents: Int = 0,
        taxCents: Int,
        tipCents: Int = 0,
        surchargeCents: Int = 0,
        totalCents: Int,
        paymentMethod: String? = nil,
        cardLastFour: String? = nil
    ) {
        self.subtotalCents = subtotalCents
        self.discountCents = discountCents
        self.taxCents = taxCents
        self.tipCents = tipCents
        self.surchargeCents = surchargeCents
        self.totalCents = totalCents
        self.paymentMethod = paymentMethod
        self.cardLastFour = cardLastFour
    }
}
