import React, { useState, useEffect } from 'react';
import { NetflixMoviesApp } from './components/NetflixMoviesApp';
import { MobileConnectView } from './components/MobileConnectView';

export default function App() {
  const [isConnectRoute, setIsConnectRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    const search = window.location.search;
    return path.includes('conectar') || search.includes('token=') || search.includes('conectar=true');
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      setIsConnectRoute(path.includes('conectar') || search.includes('token=') || search.includes('conectar=true'));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (isConnectRoute) {
    return (
      <MobileConnectView
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          setIsConnectRoute(false);
        }}
      />
    );
  }

  return <NetflixMoviesApp />;
}

