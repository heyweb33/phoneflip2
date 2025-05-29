import React, { useState } from 'react';

const ShopPage = ({ shop, onBack, onContactShop, onPhoneClick }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatWorkingHours = (hours) => {
    if (!hours) return 'Contact for hours';
    return `${hours.open} - ${hours.close}`;
  };

  const filteredPhones = shop.phones
    .filter(phone => selectedCategory === 'all' || phone.brand.toLowerCase() === selectedCategory)
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'newest':
          return new Date(b.listedDate) - new Date(a.listedDate);
        case 'oldest':
          return new Date(a.listedDate) - new Date(b.listedDate);
        default:
          return 0;
      }
    });

  const categories = ['all', ...new Set(shop.phones.map(phone => phone.brand.toLowerCase()))];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-xl font-semibold text-gray-900">{shop.name}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Shop Header */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:space-x-6">
            {/* Shop Logo */}
            <div className="flex-shrink-0 mb-4 md:mb-0">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                {shop.logo ? (
                  <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <span className="text-2xl font-bold text-blue-600">
                    {shop.name.charAt(0)}
                  </span>
                )}
              </div>
            </div>

            {/* Shop Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
                {shop.verified && (
                  <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified Shop
                  </div>
                )}
                {shop.premium && (
                  <div className="flex items-center bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Premium
                  </div>
                )}
              </div>

              <p className="text-gray-600 mb-4">{shop.description}</p>

              {/* Rating and Stats */}
              <div className="flex flex-wrap items-center space-x-6 mb-4">
                <div className="flex items-center">
                  <div className="flex items-center mr-2">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-5 h-5 ${
                          i < shop.rating ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-gray-600">({shop.totalReviews} reviews)</span>
                </div>
                <div className="text-gray-600">
                  {shop.phones.length} phones available
                </div>
                <div className="text-gray-600">
                  Member since {shop.memberSince}
                </div>
              </div>

              <button
                onClick={() => onContactShop(shop)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Contact Shop
              </button>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Address */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-gray-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Address</h3>
                <p className="text-gray-600 text-sm">{shop.address}</p>
                {shop.city && <p className="text-gray-600 text-sm">{shop.city}</p>}
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-gray-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Phone</h3>
                <p className="text-gray-600 text-sm">{shop.phone}</p>
                {shop.whatsapp && (
                  <p className="text-green-600 text-sm">WhatsApp: {shop.whatsapp}</p>
                )}
              </div>
            </div>
          </div>

          {/* Working Hours */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-gray-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Working Hours</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Mon - Fri: {formatWorkingHours(shop.workingHours?.weekdays)}</p>
                  <p>Saturday: {formatWorkingHours(shop.workingHours?.saturday)}</p>
                  <p>Sunday: {shop.workingHours?.sunday || 'Closed'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category === 'all' ? 'All Phones' : category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Phone Listings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPhones.map((phone) => (
            <div
              key={phone.id}
              onClick={() => onPhoneClick(phone)}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
            >
              <div className="aspect-square bg-gray-100">
                <img
                  src={phone.image}
                  alt={phone.model}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{phone.model}</h3>
                <p className="text-2xl font-bold text-blue-600 mb-2">{formatPrice(phone.price)}</p>
                <div className="space-y-1">
                  <div className="flex items-center text-sm text-gray-600">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      phone.condition === 'Excellent' ? 'bg-green-100 text-green-700' :
                      phone.condition === 'Good' ? 'bg-blue-100 text-blue-700' :
                      phone.condition === 'Fair' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {phone.condition}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{phone.storage} • {phone.color}</p>
                  <p className="text-xs text-gray-500">Listed {phone.timeAgo}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredPhones.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No phones found</h3>
            <p className="text-gray-600">Try adjusting your filters or check back later.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopPage;