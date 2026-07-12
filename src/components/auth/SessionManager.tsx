import React from 'react';
import { useSessions } from '../../hooks/auth/useSessions';
import type { Session } from '../../types';

/**
 * Session management component
 * Shows active sessions and allows logout from all devices
 */
const SessionManager: React.FC = () => {
  const {
    sessions: _,
    sessionCount,
    isLoading,
    error,
    refetch,
    getCurrentSession,
    getOtherSessions,
    logoutAll,
    isLoggingOutAll,
  } = useSessions();

  const formatLastActivity = (date: string): string => {
    return new Date(date).toLocaleString();
  };

  const getDeviceIcon = (platform?: string): string => {
    switch (platform?.toLowerCase()) {
      case 'ios':
        return 'Mobile';
      case 'android':
        return 'Mobile';
      case 'windows':
        return 'PC';
      case 'macos':
        return 'Mac';
      case 'linux':
        return 'Linux';
      default:
        return 'Web';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-300 rounded"></div>
            <div className="h-16 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="text-red-400">Warning</div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Failed to load sessions</h3>
              <div className="mt-2">
                <button
                  onClick={() => refetch()}
                  className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentSession = getCurrentSession();
  const otherSessions = getOtherSessions();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Active Sessions ({sessionCount})</h2>
        {sessionCount > 1 && (
          <button
            onClick={() => logoutAll()}
            disabled={isLoggingOutAll}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isLoggingOutAll ? 'Logging out...' : 'Logout All Devices'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Current Session */}
        {currentSession && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">{getDeviceIcon(currentSession.deviceInfo?.platform)}</div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900">
                      {currentSession.deviceInfo?.browser || 'Unknown Browser'}
                    </h3>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      Current
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {currentSession.deviceInfo?.platform || 'Unknown Platform'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last active: {formatLastActivity(currentSession.lastActivity)}
                  </p>
                  {currentSession.deviceInfo?.ip && (
                    <p className="text-xs text-gray-500">IP: {currentSession.deviceInfo.ip}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other Sessions */}
        {otherSessions.map((session: Session) => (
          <div key={session.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">{getDeviceIcon(session.deviceInfo?.platform)}</div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {session.deviceInfo?.browser || 'Unknown Browser'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {session.deviceInfo?.platform || 'Unknown Platform'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last active: {formatLastActivity(session.lastActivity)}
                  </p>
                  {session.deviceInfo?.ip && (
                    <p className="text-xs text-gray-500">IP: {session.deviceInfo.ip}</p>
                  )}
                  {session.location && (
                    <p className="text-xs text-gray-500">
                      {[session.location.city, session.location.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {sessionCount === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">Lock</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No active sessions</h3>
            <p className="text-gray-600">You are not logged in on any devices.</p>
          </div>
        )}
      </div>

      {/* Session Security Info */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Session Security</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>Sessions automatically expire after 7 days of inactivity</p>
          <p>Access tokens refresh every 15 minutes for security</p>
          <p>Changing your password logs out all devices</p>
          <p>Maximum 3 concurrent sessions allowed</p>
        </div>
      </div>
    </div>
  );
};

export default SessionManager;
