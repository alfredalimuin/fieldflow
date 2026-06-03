export const metadata = { title: 'FieldFlow', description: 'Field Service Operations Hub' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f8fafc' }}>
        {children}
      </body>
    </html>
  )
}
