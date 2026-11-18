import SwiftUI
import WebKit

// Minimal native shell: one WKWebView that loads the built Encore web app
// from the app bundle, so Kane's simulator runs exercise exactly the same
// markup and planted barriers as the web lanes.
@main
struct EncoreApp: App {
    var body: some Scene {
        WindowGroup {
            WebView()
                .ignoresSafeArea()
        }
    }
}

struct WebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
