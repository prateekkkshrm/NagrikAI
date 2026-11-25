import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Error clearing storage:", e);
    }
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          backgroundColor: "#080b0e",
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center"
        }}>
          <div style={{
            maxWidth: "480px",
            width: "100%",
            backgroundColor: "#111827",
            border: "1px solid #1f2937",
            borderRadius: "16px",
            padding: "28px 24px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)"
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              margin: "0 auto 16px"
            }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px", color: "#f8fafc" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "20px", lineHeight: "1.5" }}>
              An unexpected error occurred while rendering the application.
            </p>
            {this.state.error?.message && (
              <pre style={{
                backgroundColor: "#030712",
                color: "#f87171",
                padding: "12px",
                borderRadius: "8px",
                fontSize: "12px",
                textAlign: "left",
                overflowX: "auto",
                marginBottom: "20px",
                maxHeight: "140px",
                whiteSpace: "pre-wrap"
              }}>
                {this.state.error?.stack || this.state.error.message}
              </pre>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Reload
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  backgroundColor: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                Clear Data & Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
