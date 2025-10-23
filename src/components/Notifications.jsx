import React from 'react'

const Notifications = ({ notifications }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map(notif => (
        <div
          key={notif.id}
          className={`min-w-[300px] max-w-md p-4 rounded-lg shadow-lg transform transition-all duration-300 animate-slideIn ${
            notif.type === 'success' ? 'bg-green-500 text-white' :
            notif.type === 'error' ? 'bg-red-500 text-white' :
            notif.type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {notif.type === 'success' ? '✅' :
               notif.type === 'error' ? '❌' :
               notif.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <p className="font-medium">{notif.message}</p>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

export default Notifications
