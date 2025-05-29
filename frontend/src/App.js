import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [listings, setListings] = useState([]);
  const [cities, setCities] = useState([]);
  const [phoneBrands, setPhoneBrands] = useState({});
  const [storageOptions, setStorageOptions] = useState([]);
  const [conditionOptions, setConditionOptions] = useState([]);
  const [filters, setFilters] = useState({
    brand: '',
    city: '',
    condition: '',
    search: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'recent'
  });
  const [selectedListing, setSelectedListing] = useState(null);
  const [searchHistory, setSearchHistory] = useState(['iPhone 13', 'Samsung S24', 'Xiaomi Note']);
  const [favorites, setFavorites] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [savedSearches, setSavedSearches] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const wsRef = useRef(null);

  // Set up axios interceptor for auth
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      loadCurrentUser();
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const loadCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
      connectWebSocket();
    } catch (error) {
      console.error('Error loading current user:', error);
      // Clear invalid token
      setToken(null);
      localStorage.removeItem('token');
    }
  };

  // WebSocket connection for real-time messaging
  const connectWebSocket = () => {
    if (user && !wsRef.current) {
      // For now, we'll skip WebSocket since it needs additional setup
      // TODO: Implement WebSocket when ready
      console.log('WebSocket connection would be established for user:', user.id);
    }
  };

  // Load initial data
  useEffect(() => {
    loadInitialData();
    if (user) {
      loadUserData();
    }
  }, [user]);

  useEffect(() => {
    loadListings();
  }, [filters.brand, filters.city, filters.condition, filters.sortBy]);

  const loadInitialData = async () => {
    try {
      const [citiesRes, brandsRes, storageRes, conditionRes] = await Promise.all([
        axios.get(`${API}/cities`),
        axios.get(`${API}/phone-brands`),
        axios.get(`${API}/storage-options`),
        axios.get(`${API}/condition-options`)
      ]);

      setCities(citiesRes.data.cities);
      setPhoneBrands(brandsRes.data.brands);
      setStorageOptions(storageRes.data.storage_options);
      setConditionOptions(conditionRes.data.condition_options);
    } catch (error) {
      console.error('Error loading initial data:', error);
      showToast('Error loading app data', 'error');
    }
  };

  const loadUserData = async () => {
    if (!user) return;
    
    try {
      await Promise.all([
        loadFavorites(),
        loadConversations(),
        loadSavedSearches(),
        loadAnalytics()
      ]);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadListings = async (searchFilters = {}, pageNum = 1, append = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Add filters
      Object.entries({...filters, ...searchFilters}).forEach(([key, value]) => {
        if (value && key !== 'search') {
          if (key === 'minPrice' || key === 'maxPrice') {
            params.append(key.replace('Price', '_price'), value);
          } else {
            params.append(key === 'sortBy' ? 'sort_by' : key, value);
          }
        }
      });
      
      if (searchFilters.search || filters.search) {
        params.append('search', searchFilters.search || filters.search);
      }
      
      params.append('page', pageNum);
      params.append('limit', '20');

      const response = await axios.get(`${API}/listings?${params}`);
      
      if (append) {
        setListings(prev => [...prev, ...response.data]);
      } else {
        setListings(response.data);
      }
      
      setHasMoreListings(response.data.length === 20);
      setPage(pageNum);
    } catch (error) {
      console.error('Error loading listings:', error);
      showToast('Error loading listings', 'error');
      setListings([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const loadMoreListings = () => {
    if (hasMoreListings && !loading) {
      loadListings({}, page + 1, true);
    }
  };

  const loadFavorites = async () => {
    try {
      const response = await axios.get(`${API}/favorites`);
      setFavorites(response.data);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const response = await axios.get(`${API}/conversations`);
      setConversations(response.data);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await axios.get(`${API}/conversations/${conversationId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadSavedSearches = async () => {
    try {
      const response = await axios.get(`${API}/saved-searches`);
      setSavedSearches(response.data);
    } catch (error) {
      console.error('Error loading saved searches:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadUserReviews = async (userId) => {
    try {
      const response = await axios.get(`${API}/users/${userId}/reviews`);
      setReviews(response.data);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  // Authentication functions
  const handleLogin = async (loginData) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/auth/login`, loginData);
      
      setToken(response.data.access_token);
      setUser(response.data.user);
      localStorage.setItem('token', response.data.access_token);
      
      showToast('Login successful!', 'success');
      setCurrentPage('home');
    } catch (error) {
      showToast(error.response?.data?.detail || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (registerData) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/auth/register`, registerData);
      
      setToken(response.data.access_token);
      setUser(response.data.user);
      localStorage.setItem('token', response.data.access_token);
      
      showToast('Registration successful!', 'success');
      setCurrentPage('congratulations');
    } catch (error) {
      showToast(error.response?.data?.detail || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider, token, userInfo) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/auth/social-login`, {
        provider,
        token,
        user_info: userInfo
      });
      
      setToken(response.data.access_token);
      setUser(response.data.user);
      localStorage.setItem('token', response.data.access_token);
      
      showToast('Login successful!', 'success');
      setCurrentPage('home');
    } catch (error) {
      showToast(error.response?.data?.detail || 'Social login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setCurrentPage('home');
    showToast('Logged out successfully', 'info');
  };

  // Search and filter functions
  const handleSearch = (searchTerm = filters.search) => {
    const searchParams = {};
    if (searchTerm) {
      searchParams.search = searchTerm;
      // Add to search history
      if (!searchHistory.includes(searchTerm)) {
        setSearchHistory([searchTerm, ...searchHistory.slice(0, 4)]);
      }
    }
    
    setFilters(prev => ({...prev, search: searchTerm}));
    loadListings(searchParams);
    setCurrentPage('searchResults');
  };

  const applySavedSearch = (savedSearch) => {
    setFilters(prev => ({...prev, ...savedSearch.search_query}));
    loadListings(savedSearch.search_query);
    setCurrentPage('searchResults');
  };

  const saveCurrentSearch = async (name) => {
    try {
      await axios.post(`${API}/saved-searches`, {
        name,
        search_query: filters
      });
      loadSavedSearches();
      showToast('Search saved successfully', 'success');
    } catch (error) {
      showToast('Error saving search', 'error');
    }
  };

  // Favorites functions
  const toggleFavorite = async (listingId) => {
    if (!user) {
      showToast('Please login to add favorites', 'error');
      return;
    }

    try {
      const isFavorited = favorites.some(fav => fav.id === listingId);
      
      if (isFavorited) {
        await axios.delete(`${API}/favorites/${listingId}`);
        showToast('Removed from favorites', 'info');
      } else {
        await axios.post(`${API}/favorites/${listingId}`);
        showToast('Added to favorites', 'success');
      }
      
      loadFavorites();
    } catch (error) {
      showToast('Error updating favorites', 'error');
    }
  };

  // Messaging functions
  const sendMessage = async (receiverId, listingId, content, messageType = 'text', offerAmount = null) => {
    if (!user) {
      showToast('Please login to send messages', 'error');
      return;
    }

    try {
      await axios.post(`${API}/messages`, {
        receiver_id: receiverId,
        listing_id: listingId,
        content,
        message_type: messageType,
        offer_amount: offerAmount
      });
      
      if (selectedConversation) {
        loadMessages(selectedConversation.id);
      }
      loadConversations();
    } catch (error) {
      showToast('Error sending message', 'error');
    }
  };

  // Review functions
  const submitReview = async (reviewedUserId, listingId, rating, comment) => {
    if (!user) {
      showToast('Please login to submit reviews', 'error');
      return;
    }

    try {
      await axios.post(`${API}/reviews`, {
        reviewed_user_id: reviewedUserId,
        listing_id: listingId,
        rating,
        comment
      });
      
      showToast('Review submitted successfully', 'success');
      loadUserReviews(reviewedUserId);
    } catch (error) {
      showToast(error.response?.data?.detail || 'Error submitting review', 'error');
    }
  };

  // Toast notification function
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Header Component with Logo
  const Header = ({ title = "", showBack = false, showSearch = true, showProfile = false, showLogo = false }) => (
    <div className="header">
      <div className="header-content">
        {showBack && (
          <button onClick={() => setCurrentPage('home')} className="back-btn">
            ←
          </button>
        )}
        
        {showLogo ? (
          <div className="header-logo" onClick={() => setCurrentPage('home')}>
            <img 
              src="https://i.ibb.co/JjYDNHJn/Untitled-design-6.png" 
              alt="PhoneFlip" 
              className="header-logo-img"
            />
          </div>
        ) : (
          <h1 className="header-title">{title || "phoneflip"}</h1>
        )}
        
        {showSearch && (
          <button onClick={() => setCurrentPage('search')} className="search-btn">
            🔍
          </button>
        )}
        {showProfile && user && (
          <button onClick={() => setCurrentPage('profile')} className="profile-btn">
            👤
          </button>
        )}
      </div>
      {showSearch && currentPage === 'home' && (
        <div className="search-container">
          <input
            type="text"
            placeholder="Search Mobile Phones"
            className="search-input"
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={() => handleSearch()} className="search-icon">🔍</button>
        </div>
      )}
    </div>
  );

  // Bottom Navigation with modern icons
  const BottomNav = () => (
    <div className="bottom-nav">
      <button 
        className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
        onClick={() => setCurrentPage('home')}
      >
        <span className="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </span>
      </button>
      <button 
        className={`nav-item ${currentPage === 'categories' ? 'active' : ''}`}
        onClick={() => setCurrentPage('categories')}
      >
        <span className="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
          </svg>
        </span>
      </button>
      <button 
        className={`nav-item ${currentPage === 'sell' ? 'active' : ''}`}
        onClick={() => user ? setCurrentPage('userTypeSelection') : setCurrentPage('authSelection')}
      >
        <span className="nav-icon orange-plus">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </span>
      </button>
      <button 
        className={`nav-item ${currentPage === 'messages' ? 'active' : ''}`}
        onClick={() => user ? setCurrentPage('messages') : setCurrentPage('authSelection')}
      >
        <span className="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        </span>
        {conversations.length > 0 && (
          <span className="notification-badge">{conversations.reduce((sum, conv) => sum + conv.unread_count, 0)}</span>
        )}
      </button>
      <button 
        className={`nav-item ${currentPage === 'profile' ? 'active' : ''}`}
        onClick={() => user ? setCurrentPage('profile') : setCurrentPage('authSelection')}
      >
        <span className="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </span>
      </button>
    </div>
  );

  // Enhanced Logo Component with your actual logo
  const Logo = ({ compact = false }) => (
    <div className={`logo-container ${compact ? 'compact' : ''}`}>
      <div className="logo-image-container">
        <img 
          src="https://i.ibb.co/JjYDNHJn/Untitled-design-6.png" 
          alt="PhoneFlip Logo" 
          className="logo-image"
          onError={(e) => {
            // Fallback in case image fails to load
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        <div className="logo-fallback" style={{display: 'none'}}>
          <div className="logo-icon">
            <svg width="80" height="80" viewBox="0 0 120 120" fill="none">
              <rect width="120" height="120" rx="28" fill="url(#logoGradient)"/>
              <rect x="45" y="35" width="30" height="50" rx="4" fill="white" stroke="none"/>
              <rect x="48" y="40" width="24" height="35" rx="2" fill="#1e40af"/>
              <circle cx="60" cy="79" r="3" fill="white"/>
              <path d="M25 45 C25 35, 35 25, 45 25 L50 25" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
              <path d="M42 20 L50 25 L42 30" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
              <path d="M95 75 C95 85, 85 95, 75 95 L70 95" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
              <path d="M78 100 L70 95 L78 90" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e40af"/>
                  <stop offset="50%" stopColor="#3b82f6"/>
                  <stop offset="100%" stopColor="#1e40af"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
      {!compact && (
        <>
          <h1 className="logo-text">phoneflip</h1>
          <p className="logo-tagline">Your Next Phone, Just a Flip Away!</p>
        </>
      )}
    </div>
  );

  // Auth Selection Page
  const AuthSelectionPage = () => (
    <div className="page">
      <Header title="" showBack={true} showSearch={false} showLogo={true} />
      
      <div className="content centered">
        <Logo />
        
        <div className="auth-options">
          <button 
            className="auth-option-btn primary"
            onClick={() => setCurrentPage('login')}
          >
            Login to Your Account
          </button>
          
          <button 
            className="auth-option-btn secondary"
            onClick={() => setCurrentPage('register')}
          >
            Create New Account
          </button>
          
          <div className="social-login-section">
            <p className="social-login-text">Or continue with</p>
            <div className="social-buttons">
              <button 
                className="social-btn google"
                onClick={() => showToast('Google login - Add your API key', 'info')}
              >
                🔍 Google
              </button>
              <button 
                className="social-btn facebook"
                onClick={() => showToast('Facebook login - Add your API key', 'info')}
              >
                📘 Facebook
              </button>
              <button 
                className="social-btn apple"
                onClick={() => showToast('Apple login - Add your API key', 'info')}
              >
                🍎 Apple
              </button>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );

  // Login Page
  const LoginPage = () => {
    const [formData, setFormData] = useState({
      email: '',
      phone: '',
      password: '',
      loginMethod: 'email'
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      handleLogin({
        email: formData.loginMethod === 'email' ? formData.email : null,
        phone: formData.loginMethod === 'phone' ? formData.phone : null,
        password: formData.password,
        login_method: formData.loginMethod
      });
    };

    return (
      <div className="page">
        <Header title="" showBack={true} showSearch={false} showLogo={true} />
        
        <div className="content">
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label>Login Method</label>
              <select
                className="form-input"
                value={formData.loginMethod}
                onChange={(e) => setFormData({...formData, loginMethod: e.target.value})}
              >
                <option value="email">Email</option>
                <option value="phone">Phone Number</option>
              </select>
            </div>

            {formData.loginMethod === 'email' ? (
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            ) : (
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  required
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            )}

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                required
                className="form-input"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <div className="auth-links">
            <button 
              className="link-btn"
              onClick={() => setCurrentPage('register')}
            >
              Don't have an account? Register
            </button>
          </div>
        </div>

        <BottomNav />
      </div>
    );
  };

  // Enhanced Registration Form with Social Login
  const RegistrationForm = () => {
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      userType: 'individual',
      city: '',
      address: '',
      shopName: '',
      profilePicture: null
    });
    const [step, setStep] = useState(1);

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (formData.password !== formData.confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }

      handleRegister({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        user_type: formData.userType,
        city: formData.city,
        address: formData.address || null,
        shop_name: formData.userType === 'shop' ? formData.shopName : null,
        login_method: 'email'
      });
    };

    const handleSocialLogin = (provider) => {
      showToast(`${provider} login integration ready - Add your API keys`, 'info');
    };

    return (
      <div className="page">
        <Header title="" showBack={true} showSearch={false} showLogo={true} />
        
        <div className="content">
          <div className="auth-container">
            <div className="auth-header">
              <h2>Join PhoneFlip</h2>
              <p>Create your account and start trading phones</p>
            </div>

            {/* Social Login Options */}
            <div className="social-login-section">
              <p className="social-title">Continue with</p>
              <div className="social-buttons-grid">
                <button className="social-btn google" onClick={() => handleSocialLogin('Google')}>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                
                <button className="social-btn facebook" onClick={() => handleSocialLogin('Facebook')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877f2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </button>
                
                <button className="social-btn apple" onClick={() => handleSocialLogin('Apple')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#000">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  Apple
                </button>
              </div>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            {/* Multi-step Registration Form */}
            <form onSubmit={handleSubmit} className="registration-form">
              {step === 1 && (
                <div className="form-step">
                  <h3>Basic Information</h3>
                  
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      className="form-input"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      required
                      className="form-input"
                      placeholder="+92 300 0000000"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>

                  <button type="button" className="next-btn" onClick={() => setStep(2)}>
                    Continue
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
                    </svg>
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="form-step">
                  <h3>Account Security</h3>
                  
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      required
                      className="form-input"
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                    />
                    <div className="password-strength">
                      <span className={`strength-indicator ${formData.password.length > 6 ? 'good' : ''}`}></span>
                      <span className={`strength-indicator ${formData.password.length > 8 && /[A-Z]/.test(formData.password) ? 'good' : ''}`}></span>
                      <span className={`strength-indicator ${formData.password.length > 8 && /[0-9]/.test(formData.password) && /[A-Z]/.test(formData.password) ? 'good' : ''}`}></span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      required
                      className="form-input"
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    />
                  </div>

                  <div className="two-factor-option">
                    <label className="checkbox-label">
                      <input type="checkbox" />
                      <span className="checkmark"></span>
                      Enable Two-Factor Authentication (Recommended)
                    </label>
                  </div>

                  <div className="step-buttons">
                    <button type="button" className="back-btn" onClick={() => setStep(1)}>Back</button>
                    <button type="button" className="next-btn" onClick={() => setStep(3)}>Continue</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="form-step">
                  <h3>Profile Setup</h3>
                  
                  <div className="form-group">
                    <label>Account Type</label>
                    <div className="user-type-selection">
                      <div className={`type-option ${formData.userType === 'individual' ? 'selected' : ''}`}
                           onClick={() => setFormData({...formData, userType: 'individual'})}>
                        <div className="type-icon">👤</div>
                        <h4>Individual</h4>
                        <p>Personal seller account</p>
                      </div>
                      <div className={`type-option ${formData.userType === 'shop' ? 'selected' : ''}`}
                           onClick={() => setFormData({...formData, userType: 'shop'})}>
                        <div className="type-icon">🏪</div>
                        <h4>Shop Owner</h4>
                        <p>Business account with analytics</p>
                      </div>
                    </div>
                  </div>

                  {formData.userType === 'shop' && (
                    <div className="form-group">
                      <label>Shop Name</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="Your shop name"
                        value={formData.shopName}
                        onChange={(e) => setFormData({...formData, shopName: e.target.value})}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>City</label>
                    <select
                      required
                      className="form-input"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    >
                      <option value="">Select your city</option>
                      {cities.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Address (Optional)</label>
                    <textarea
                      className="form-input"
                      rows="2"
                      placeholder="Your address"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>

                  <div className="step-buttons">
                    <button type="button" className="back-btn" onClick={() => setStep(2)}>Back</button>
                    <button type="submit" className="submit-btn" disabled={loading}>
                      {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                  </div>
                </div>
              )}
            </form>
            
            <div className="auth-footer">
              <p>Already have an account? 
                <button className="link-btn" onClick={() => setCurrentPage('login')}>
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </div>

        <BottomNav />
      </div>
    );
  };

  // Enhanced Home Page with Logo in Header
  const HomePage = () => (
    <div className="page">
      <Header showProfile={true} showLogo={true} />
      
      <div className="content">
        {!user && <Logo />}
        
        {/* Welcome back section for logged in users */}
        {user && (
          <div className="welcome-section">
            <h2>Welcome back, {user.name}! 👋</h2>
            <p>Find your perfect phone or sell yours today</p>
          </div>
        )}
        
        <div className="section">
          <div className="section-header">
            <h3>Recent Searches</h3>
            <button className="view-all">View All</button>
          </div>
          <div className="search-history">
            {searchHistory.map((term, index) => (
              <button 
                key={index} 
                className="search-chip"
                onClick={() => {
                  setFilters({...filters, search: term});
                  handleSearch(term);
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Saved Searches for logged in users */}
        {user && savedSearches.length > 0 && (
          <div className="section">
            <div className="section-header">
              <h3>Saved Searches</h3>
              <button className="view-all" onClick={() => setCurrentPage('savedSearches')}>View All</button>
            </div>
            <div className="search-history">
              {savedSearches.slice(0, 3).map((search) => (
                <button 
                  key={search.id} 
                  className="search-chip saved"
                  onClick={() => applySavedSearch(search)}
                >
                  {search.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="section">
          <div className="section-header">
            <h3>Recent Listings</h3>
            <button className="view-all" onClick={() => setCurrentPage('searchResults')}>View All</button>
          </div>
          <div className="phone-grid">
            {listings.length > 0 ? (
              listings.slice(0, 4).map(listing => (
                <PhoneCard key={listing.id} listing={listing} compact={true} />
              ))
            ) : (
              // Sample listings with images for demo
              Array.from({length: 4}).map((_, index) => (
                <div key={index} className="phone-card sample">
                  <div className="phone-image">
                    <div className="image-placeholder">📱</div>
                  </div>
                  <div className="phone-info">
                    <h4>Loading phones...</h4>
                    <p className="phone-condition">Please wait</p>
                    <p className="phone-price">---</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {user && (
          <div className="section">
            <div className="section-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="quick-actions">
              <button 
                className="action-btn sell"
                onClick={() => setCurrentPage('userTypeSelection')}
              >
                <div className="action-icon">💰</div>
                <span>Sell Phone</span>
              </button>
              <button 
                className="action-btn favorites"
                onClick={() => setCurrentPage('favorites')}
              >
                <div className="action-icon">❤️</div>
                <span>Favorites</span>
              </button>
              <button 
                className="action-btn messages"
                onClick={() => setCurrentPage('messages')}
              >
                <div className="action-icon">💬</div>
                <span>Messages</span>
              </button>
            </div>
          </div>
        )}
      </div>
      
      <BottomNav />
    </div>
  );

  // Phone Card Component
  const PhoneCard = ({ listing, compact = false }) => (
    <div className={`phone-card ${compact ? 'compact' : ''}`} onClick={() => setSelectedListing(listing)}>
      <div className="phone-image">
        {listing.images && listing.images.length > 0 ? (
          <img src={listing.images[0]} alt={listing.title} />
        ) : (
          <div className="image-placeholder">📱</div>
        )}
      </div>
      
      <button 
        className="favorite-btn"
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(listing.id);
        }}
      >
        {favorites.some(fav => fav.id === listing.id) ? '❤️' : '🤍'}
      </button>
      
      <div className="phone-info">
        <h4>{listing.title}</h4>
        <p className="phone-condition">{listing.condition}</p>
        <p className="phone-price">
          Rs {listing.price.toLocaleString()}
          {listing.negotiable && <span className="negotiable-text"> (Negotiable)</span>}
        </p>
        <p className="phone-location">📍 {listing.city}</p>
      </div>
    </div>
  );

  // Categories Page Component
  const CategoriesPage = () => (
    <div className="page">
      <Header title="Categories" showBack={true} showProfile={true} />
      
      <div className="content">
        <div className="categories-hero">
          <h2>Browse Categories</h2>
          <p>Find phones by brand, condition, or location</p>
        </div>

        <div className="categories-grid">
          {Object.entries(phoneBrands).map(([brand, models]) => (
            <div key={brand} className="category-card" onClick={() => {
              setFilters({...filters, brand});
              loadListings({brand});
              setCurrentPage('searchResults');
            }}>
              <div className={`category-icon ${brand.toLowerCase()}`}>
                <span style={{fontSize: '32px'}}>
                  {brand === 'Apple' ? '🍎' : 
                   brand === 'Samsung' ? '📱' : 
                   brand === 'Xiaomi' ? '🔥' : '📲'}
                </span>
              </div>
              <h3>{brand}</h3>
              <p>{models.length} models available</p>
              <span className="category-count">{listings.filter(l => l.brand === brand).length}</span>
            </div>
          ))}
          
          <div className="category-card" onClick={() => {
            setFilters({...filters, condition: 'New'});
            loadListings({condition: 'New'});
            setCurrentPage('searchResults');
          }}>
            <div className="category-icon new-phones">
              <span style={{fontSize: '32px'}}>✨</span>
            </div>
            <h3>New Phones</h3>
            <p>Brand new devices</p>
            <span className="category-count">{listings.filter(l => l.condition === 'New').length}</span>
          </div>
          
          <div className="category-card" onClick={() => {
            setFilters({...filters, condition: 'Like New'});
            loadListings({condition: 'Like New'});
            setCurrentPage('searchResults');
          }}>
            <div className="category-icon like-new">
              <span style={{fontSize: '32px'}}>💎</span>
            </div>
            <h3>Like New</h3>
            <p>Excellent condition</p>
            <span className="category-count">{listings.filter(l => l.condition === 'Like New').length}</span>
          </div>
        </div>

        <div className="quick-filters">
          <h3>Quick Filters</h3>
          <div className="quick-filter-chips">
            {['Under 50k', '50k-100k', '100k+', 'This Week'].map(filter => (
              <button key={filter} className="quick-chip" onClick={() => {
                // Add quick filter logic here
                showToast(`Filter: ${filter}`, 'info');
              }}>
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );

  // Search Results Page Component
  const SearchResultsPage = () => (
    <div className="page">
      <Header title="Search Results" showBack={true} showProfile={true} />
      
      <div className="content">
        <div className="search-results-header">
          <span className="results-count">{listings.length} phones found</span>
          <button className="filter-toggle" onClick={() => showToast('Filters coming soon!', 'info')}>
            🔧 Filters
          </button>
        </div>

        <div className="filters-section">
          <div className="filters-row">
            <div className="filter-group">
              <label className="filter-label">Brand</label>
              <select 
                className="filter-select"
                value={filters.brand}
                onChange={(e) => setFilters({...filters, brand: e.target.value})}
              >
                <option value="">All Brands</option>
                {Object.keys(phoneBrands).map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label className="filter-label">City</label>
              <select 
                className="filter-select"
                value={filters.city}
                onChange={(e) => setFilters({...filters, city: e.target.value})}
              >
                <option value="">All Cities</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="sort-section">
            <label className="filter-label">Sort By</label>
            <div className="sort-buttons">
              {[
                {key: 'recent', label: 'Recent'},
                {key: 'price_low', label: 'Price: Low to High'},
                {key: 'price_high', label: 'Price: High to Low'},
                {key: 'popular', label: 'Popular'}
              ].map(sort => (
                <button 
                  key={sort.key}
                  className={`sort-btn ${filters.sortBy === sort.key ? 'active' : ''}`}
                  onClick={() => setFilters({...filters, sortBy: sort.key})}
                >
                  {sort.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {listings.length > 0 ? (
          <>
            <div className="phone-grid search-results-grid">
              {listings.map(listing => (
                <PhoneCard key={listing.id} listing={listing} />
              ))}
            </div>
            
            {hasMoreListings && (
              <button className="load-more-btn" onClick={loadMoreListings} disabled={loading}>
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        ) : (
          <div className="empty-search">
            <div className="empty-icon">🔍</div>
            <h3>No phones found</h3>
            <p>Try adjusting your search criteria or browse categories</p>
            <button className="clear-filters-btn" onClick={() => {
              setFilters({
                brand: '', city: '', condition: '', search: '', 
                minPrice: '', maxPrice: '', sortBy: 'recent'
              });
              loadListings();
            }}>
              Clear Filters
            </button>
          </div>
        )}
      </div>
      
      <BottomNav />
    </div>
  );

  // Search Page Component
  const SearchPage = () => (
    <div className="page">
      <Header title="Search" showBack={true} showProfile={true} />
      
      <div className="content">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search Mobile Phones"
            className="search-input"
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            autoFocus
          />
          <button onClick={() => handleSearch()} className="search-icon">🔍</button>
        </div>

        <div className="section">
          <div className="section-header">
            <h3>Recent Searches</h3>
          </div>
          <div className="search-history">
            {searchHistory.map((term, index) => (
              <button 
                key={index} 
                className="search-chip"
                onClick={() => {
                  setFilters({...filters, search: term});
                  handleSearch(term);
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <h3>Popular Brands</h3>
          </div>
          <div className="categories-grid">
            {Object.keys(phoneBrands).slice(0, 4).map(brand => (
              <div key={brand} className="category-card" onClick={() => {
                setFilters({...filters, brand, search: brand});
                handleSearch(brand);
              }}>
                <div className={`category-icon ${brand.toLowerCase()}`}>
                  <span style={{fontSize: '24px'}}>
                    {brand === 'Apple' ? '🍎' : 
                     brand === 'Samsung' ? '📱' : 
                     brand === 'Xiaomi' ? '🔥' : '📲'}
                  </span>
                </div>
                <h3>{brand}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );

  // Profile Page Component
  const ProfilePage = () => (
    <div className="page">
      <Header title="Profile" showBack={true} />
      
      <div className="content">
        {user ? (
          <div className="profile-container">
            <div className="profile-header">
              <div className="profile-avatar">
                {user.profile_picture ? (
                  <img src={user.profile_picture} alt={user.name} />
                ) : (
                  <span>{user.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <h2>{user.name}</h2>
              <p>@{user.email}</p>
              <span className="user-type-badge">{user.user_type}</span>
            </div>

            <div className="profile-actions">
              <button className="profile-action-btn" onClick={() => setCurrentPage('favorites')}>
                <span>❤️</span> Favorites
              </button>
              <button className="profile-action-btn" onClick={() => setCurrentPage('messages')}>
                <span>💬</span> Messages
              </button>
              <button className="profile-action-btn" onClick={() => setCurrentPage('myListings')}>
                <span>📱</span> My Listings
              </button>
              <button className="profile-action-btn" onClick={() => setCurrentPage('savedSearches')}>
                <span>🔍</span> Saved Searches
              </button>
            </div>

            <div className="profile-menu">
              <button className="menu-item" onClick={() => showToast('Settings coming soon!', 'info')}>
                ⚙️ Settings
              </button>
              <button className="menu-item" onClick={() => showToast('Help coming soon!', 'info')}>
                ❓ Help & Support
              </button>
              <button className="menu-item" onClick={() => showToast('About coming soon!', 'info')}>
                ℹ️ About PhoneFlip
              </button>
              <button className="menu-item logout" onClick={handleLogout}>
                🚪 Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="auth-required">
            <div className="empty-icon">👤</div>
            <h3>Login Required</h3>
            <p>Please login to view your profile</p>
            <button className="browse-btn" onClick={() => setCurrentPage('authSelection')}>
              Login / Register
            </button>
          </div>
        )}
      </div>
      
      <BottomNav />
    </div>
  );

  // Messages Page Component
  const MessagesPage = () => (
    <div className="page">
      <Header title="Messages" showBack={true} showProfile={true} />
      
      <div className="content">
        {user ? (
          conversations.length > 0 ? (
            <div className="conversations-list">
              {conversations.map(conversation => (
                <div key={conversation.id} className="conversation-item" onClick={() => {
                  setSelectedConversation(conversation);
                  setCurrentPage('chat');
                  loadMessages(conversation.id);
                }}>
                  <div className="conversation-avatar">
                    {conversation.other_user.profile_picture ? (
                      <img src={conversation.other_user.profile_picture} alt={conversation.other_user.name} />
                    ) : (
                      <span>{conversation.other_user.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="conversation-info">
                    <h4>{conversation.other_user.name}</h4>
                    <p className="listing-title">{conversation.listing.title}</p>
                    <p className="last-message">{conversation.last_message}</p>
                    <span className="message-time">{conversation.updated_at}</span>
                  </div>
                  {conversation.unread_count > 0 && (
                    <span className="unread-badge">{conversation.unread_count}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3>No Messages Yet</h3>
              <p>Start a conversation by messaging sellers about their phones</p>
              <button className="browse-btn" onClick={() => setCurrentPage('home')}>
                Browse Phones
              </button>
            </div>
          )
        ) : (
          <div className="auth-required">
            <div className="empty-icon">💬</div>
            <h3>Login Required</h3>
            <p>Please login to view your messages</p>
            <button className="browse-btn" onClick={() => setCurrentPage('authSelection')}>
              Login / Register
            </button>
          </div>
        )}
      </div>
      
      <BottomNav />
    </div>
  );

  // Toast notification
  const ToastNotification = () => (
    toast && (
      <div className={`toast ${toast.type}`}>
        {toast.message}
      </div>
    )
  );

  // Loading overlay
  const LoadingOverlay = () => (
    loading && (
      <div className="loading-overlay">
        <div className="spinner"></div>
      </div>
    )
  );

  // Main render based on current page
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'authSelection':
        return <AuthSelectionPage />;
      case 'login':
        return <LoginPage />;
      case 'register':
        return <RegistrationForm />;
      case 'home':
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="app">
      {renderCurrentPage()}
      <ToastNotification />
      <LoadingOverlay />
    </div>
  );
}

export default App;