import './globals.css'

export const metadata = {
  title: 'Learn Your Way',
  description: 'Discover your unique learning personality in minutes.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
