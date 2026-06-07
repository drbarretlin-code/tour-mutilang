import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#f8d7da', color: '#721c24', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2>渲染發生嚴重錯誤 (React Runtime Error)</h2>
          <p>請將以下錯誤訊息提供給開發人員：</p>
          <pre style={{ border: '1px solid #f5c6cb', padding: '10px', backgroundColor: '#fff', borderRadius: '5px' }}>
            {this.state.error && this.state.error.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
