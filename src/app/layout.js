import './globals.css'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'Learn Your Way',
  description: 'Discover your unique learning personality in minutes.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
