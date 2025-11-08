import { useState } from 'react'

let notificationCounter = 0

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([])

  const showNotification = (message, type = 'success') => {
    const id = `notif-${Date.now()}-${notificationCounter++}`
    setNotifications(prev => [...prev, { id, message, type }])
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif.id !== id))
    }, 4000)
  }

  return { notifications, showNotification }
}

export default useNotifications
