import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Произошла ошибка</h2>
          <p>Попробуйте обновить страницу. Если ошибка повторяется, обратитесь в поддержку.</p>
          {process.env.NODE_ENV !== 'production' && (
            <pre style={{ whiteSpace: 'pre-wrap' }}>
              {String(this.state.error)}\n{this.state.info?.componentStack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}


