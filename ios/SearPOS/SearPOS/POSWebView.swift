import SwiftUI
import WebKit
import os

struct POSWebView: UIViewRepresentable {
    typealias UIViewType = WKWebView

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let coordinator = context.coordinator

        // Web view configuration
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Data store with persistent cookies (keeps sear_token across launches)
        let dataStore = WKWebsiteDataStore.default()
        config.websiteDataStore = dataStore

        // Preferences
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        // Register the JavaScript message handler — web app sends messages via:
        //   window.webkit.messageHandlers.posNative.postMessage({ action: "...", params: {...} })
        let contentController = config.userContentController
        contentController.add(coordinator, name: "posNative")

        // Inject a script that tells the web app it's running in the native wrapper.
        // This runs at document start, before any page JS executes.
        let nativeDetection = WKUserScript(
            source: """
            window.__SEAR_NATIVE__ = true;
            window.__SEAR_NATIVE_VERSION__ = '1.0.0';
            window.__SEAR_PLATFORM__ = 'ios';
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        contentController.addUserScript(nativeDetection)

        // Inject the posNativeCallback handler that native code calls to send data back to JS.
        // This bridges native->JS communication.
        let callbackSetup = WKUserScript(
            source: """
            window.posNativeCallback = function(event, data) {
                const evt = new CustomEvent('posNativeEvent', {
                    detail: { event: event, data: data }
                });
                window.dispatchEvent(evt);

                // Also call the nativeBridge handler if it exists
                if (window.nativeBridge && typeof window.nativeBridge.handleNativeEvent === 'function') {
                    window.nativeBridge.handleNativeEvent(event, data);
                }
            };
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        contentController.addUserScript(callbackSetup)

        // Disable double-tap zoom and pinch zoom (POS terminal should not zoom)
        let disableZoom = WKUserScript(
            source: """
            var meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            document.getElementsByTagName('head')[0].appendChild(meta);

            document.addEventListener('touchstart', function(e) {
                if (e.touches.length > 1) { e.preventDefault(); }
            }, { passive: false });

            var lastTouchEnd = 0;
            document.addEventListener('touchend', function(e) {
                var now = Date.now();
                if (now - lastTouchEnd <= 300) { e.preventDefault(); }
                lastTouchEnd = now;
            }, false);
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        contentController.addUserScript(disableZoom)

        // Create the web view
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = coordinator
        webView.uiDelegate = coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = true
        webView.backgroundColor = UIColor(red: 15/255, green: 118/255, blue: 110/255, alpha: 1.0) // Midnight Teal

        // Disable rubber-band bounce
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false

        // Disable pull-to-refresh
        webView.scrollView.refreshControl = nil

        // Disable content inset adjustments
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Inspect in Safari dev tools during debug builds
        #if DEBUG
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
        #endif

        // Attach native bridge
        coordinator.nativeBridge.attach(to: webView)
        coordinator.webView = webView

        // Load the app
        let url = URL(string: "https://getsear.com")!
        let request = URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData)
        webView.load(request)

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // No dynamic updates needed
    }

    // MARK: - Coordinator

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
        private let logger = Logger(subsystem: "com.getsear.pos", category: "WebView")
        let nativeBridge = NativeBridge()
        weak var webView: WKWebView?

        // MARK: - WKScriptMessageHandler

        nonisolated func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "posNative" else { return }
            Task { @MainActor [weak self] in
                self?.nativeBridge.handleMessage(message.body)
            }
        }

        // MARK: - WKNavigationDelegate

        nonisolated func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            // Allow navigation to getsear.com and localhost (development)
            let host = url.host?.lowercased() ?? ""
            if host.hasSuffix("getsear.com") || host == "localhost" || host == "127.0.0.1" {
                decisionHandler(.allow)
                return
            }

            // Open external links (e.g., payment processor redirects) in Safari
            if navigationAction.navigationType == .linkActivated {
                Task { @MainActor in
                    UIApplication.shared.open(url)
                }
                decisionHandler(.cancel)
                return
            }

            // Allow other navigation (iframes, XHR, etc.)
            decisionHandler(.allow)
        }

        nonisolated func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { @MainActor [weak self] in
                self?.logger.info("Page loaded: \(webView.url?.absoluteString ?? "unknown")")
            }
        }

        nonisolated func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
            Task { @MainActor [weak self] in
                self?.logger.error("Navigation failed: \(error.localizedDescription)")
                self?.showOfflinePage(in: webView)
            }
        }

        nonisolated func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: any Error
        ) {
            Task { @MainActor [weak self] in
                self?.logger.error("Provisional navigation failed: \(error.localizedDescription)")
                self?.showOfflinePage(in: webView)
            }
        }

        // MARK: - WKUIDelegate

        // Handle JavaScript alert()
        nonisolated func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            Task { @MainActor in
                guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                      let rootVC = windowScene.windows.first?.rootViewController else {
                    completionHandler()
                    return
                }

                let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                    completionHandler()
                })
                rootVC.present(alert, animated: true)
            }
        }

        // Handle JavaScript confirm()
        nonisolated func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            Task { @MainActor in
                guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                      let rootVC = windowScene.windows.first?.rootViewController else {
                    completionHandler(false)
                    return
                }

                let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
                    completionHandler(false)
                })
                alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                    completionHandler(true)
                })
                rootVC.present(alert, animated: true)
            }
        }

        // MARK: - Offline Page

        private func showOfflinePage(in webView: WKWebView) {
            let html = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                        background: #0F766E;
                        color: white;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        text-align: center;
                    }
                    h1 { font-size: 2em; margin-bottom: 0.5em; }
                    p { font-size: 1.2em; opacity: 0.8; margin-bottom: 2em; }
                    button {
                        background: white;
                        color: #0F766E;
                        border: none;
                        padding: 16px 48px;
                        font-size: 1.1em;
                        font-weight: 600;
                        border-radius: 8px;
                        cursor: pointer;
                    }
                    button:active { opacity: 0.8; }
                </style>
            </head>
            <body>
                <h1>Sear POS</h1>
                <p>Unable to connect to the server.<br>Check your internet connection and try again.</p>
                <button onclick="window.location.reload()">Retry</button>
            </body>
            </html>
            """
            webView.loadHTMLString(html, baseURL: nil)
        }
    }
}
