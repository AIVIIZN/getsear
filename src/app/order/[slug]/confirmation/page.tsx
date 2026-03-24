'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Check, Clock, MapPin, Phone } from 'lucide-react'

interface OrderConfirmation {
  order_id: string
  status: string
  estimated_time: string
  total: string
}

export default function ConfirmationPage() {
  const params = useParams()
  const [order, setOrder] = useState<OrderConfirmation | null>(null)
  const [location, setLocation] = useState<{ name: string; address: string; phone: string } | null>(null)

  useEffect(() => {
    const orderData = sessionStorage.getItem('sear-order-confirmation')
    const locationData = sessionStorage.getItem('sear-location')
    if (orderData) setOrder(JSON.parse(orderData))
    if (locationData) setLocation(JSON.parse(locationData))
  }, [])

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 text-center">
        <div>
          <p className="text-gray-500">No order found</p>
          <a href={`/order/${params.slug}`} className="text-blue-500 mt-2 inline-block font-medium">
            Back to menu
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Order Confirmed!</h1>
        <p className="text-gray-500 mt-1">Your order has been received</p>
      </div>

      {/* Order Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4 max-w-md mx-auto">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <span className="text-sm text-gray-500">Order #</span>
          <span className="font-mono font-medium text-sm">{order.order_id.slice(-8).toUpperCase()}</span>
        </div>

        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <span className="text-sm text-gray-500">Total</span>
          <span className="font-bold text-lg text-blue-600">${order.total}</span>
        </div>

        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <Clock className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-sm font-medium">Estimated Time</p>
            <p className="text-xs text-gray-500">{order.estimated_time}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <span className="text-sm px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
            {order.status === 'pending' ? 'Waiting for confirmation' : order.status}
          </span>
        </div>

        {location && (
          <div className="space-y-2 pt-1">
            <p className="font-semibold text-sm">{location.name}</p>
            {location.address && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location.address}
              </p>
            )}
            {location.phone && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {location.phone}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="text-center mt-8">
        <a
          href={`/order/${params.slug}`}
          className="text-blue-500 font-medium text-sm hover:underline"
        >
          Order more
        </a>
      </div>
    </div>
  )
}
