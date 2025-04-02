import React, { useState, useEffect, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Profile from './components/Profile';
import NotFound from './components/NotFound';
import './styles/main.css';

// Context for global state
export const AppContext = createContext();

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('okeyUser');
    return savedUser ? JSON.parse(savedUser) : {
      name: '',
      avatar: 'https://i.imgur.com/default-avatar.png',
      token: null,
      stats: { wins: 0, losses: 0, totalGames: 0 }
    };
  });

  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: { token: user.token },
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      autoConnect: false
    });

    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setNotification({
        type: 'error',
        message: 'Sunucu bağlantısı kesildi. Tekrar bağlanılıyor...'
      });
    });

    // Authentication handling
    newSocket.on('authenticated', () => {
      setIsLoading(false);
    });

    newSocket.on('unauthorized', (err) => {
      console.error('Auth error:', err);
      setUser(prev => ({ ...prev, token: null }));
      localStorage.removeItem('okeyUser');
      newSocket.disconnect();
    });

    // Connect only if authenticated
    if (user.token) {
      newSocket.connect();
    } else {
      setIsLoading(false);
    }

    return () => {
      newSocket.disconnect();
    };
  }, [user.token]);

  // Persist user data
  useEffect(() => {
    if (user.name || user.token) {
      localStorage.setItem('okeyUser', JSON.stringify(user));
    }
  }, [user]);

  // Notification timeout
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const login = (userData) => {
    setUser(prev => ({
      ...prev,
      ...userData,
      token: userData.token
    }));
  };

  const logout = () => {
    if (socket) socket.disconnect();
    setUser({
      name: '',
      avatar: 'https://i.imgur.com/default-avatar.png',
      token: null
    });
    localStorage.removeItem('okeyUser');
  };

  const updateProfile = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
    setNotification({
      type: 'success',
      message: 'Profil güncellendi!'
    });
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Uygulama yükleniyor...</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ user, socket, notification }}>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              user.token ? (
                <Layout logout={logout} />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          >
            <Route index element={<Lobby />} />
            <Route path="room/:roomId" element={<GameBoard />} />
            <Route 
              path="profile" 
              element={
                <Profile 
                  updateProfile={updateProfile} 
                  logout={logout} 
                />
              } 
            />
          </Route>
          
          <Route 
            path="/auth" 
            element={
              !user.token ? (
                <Auth login={login} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  );
}

export default App;