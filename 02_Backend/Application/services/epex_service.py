import statistics
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

class EPEXService:
    def __init__(self, db_bridge):
        self.db = db_bridge
        self.analysis_days = 14  # 2 weeks
        
        # Cache for price statistics
        self._cached_stats = None
        self._cache_timestamp = None
        self._cache_ttl_seconds = 3600  # 1 hour 
    
    def get_price_statistics(self):
    
        # Check if cache is valid
        now = datetime.now(ZoneInfo("Europe/Vienna"))
        
        if self._is_cache_valid(now):
            # Update only current price (changes every hour)
            current_price = self.db.get_current_epex_price()
            if current_price is not None:
                self._cached_stats["current"] = round(current_price, 2)
                
                # Recalculate is_cheap with new current price
                threshold = self._cached_stats.get("threshold")
                emergency_threshold = self._cached_stats.get("emergency_threshold")
                
                if threshold is not None:
                    self._cached_stats["is_cheap"] = current_price <= threshold
                
                if emergency_threshold is not None:
                    self._cached_stats["is_emergency_cheap"] = current_price <= emergency_threshold
            
            return self._cached_stats
        
        # Cache invalid or empty - fetch new data
        try:
            start_time = now - timedelta(days=self.analysis_days)
            
            # Get 14 days of historical prices
            prices = self.db.query_epex_prices(start_time, now)
            
            # Get current price
            current_price = self.db.get_current_epex_price()
            
            if not prices or len(prices) < 10:
                return {
                    "min": None,
                    "max": None,
                    "avg": None,
                    "current": current_price,
                    "threshold": None,
                    "emergency_threshold": None,
                    "is_cheap": False,
                    "is_emergency_cheap": False,
                    "span": None,
                    "data_points": len(prices) if prices else 0,
                    "error": "Insufficient EPEX data (need at least 10 data points)"
                }
            
            if current_price is None:
                return {
                    "min": round(min(prices), 2),
                    "max": round(max(prices), 2),
                    "avg": round(statistics.mean(prices), 2),
                    "current": None,
                    "threshold": None,
                    "emergency_threshold": None,
                    "is_cheap": False,
                    "is_emergency_cheap": False,
                    "span": round(max(prices) - min(prices), 2),
                    "data_points": len(prices),
                    "error": "Current price unavailable"
                }
            
            min_price = min(prices)
            max_price = max(prices)
            avg_price = statistics.mean(prices)
            span = max_price - min_price
            
            # Automatic threshold: lower third of 14-day price range
            threshold = min_price + (span * 0.33)
            
            # Emergency threshold: lower 20% (extremely cheap)
            emergency_threshold = min_price + (span * 0.20)
            
            is_cheap = current_price <= threshold
            is_emergency_cheap = current_price <= emergency_threshold
            
            # Cache the result
            self._cached_stats = {
                "min": round(min_price, 2),
                "max": round(max_price, 2),
                "avg": round(avg_price, 2),
                "current": round(current_price, 2),
                "threshold": round(threshold, 2),
                "emergency_threshold": round(emergency_threshold, 2),
                "is_cheap": is_cheap,
                "is_emergency_cheap": is_emergency_cheap,
                "span": round(span, 2),
                "data_points": len(prices)
            }
            self._cache_timestamp = now
            
            return self._cached_stats
            
        except Exception as e:
            return {
                "min": None,
                "max": None,
                "avg": None,
                "current": None,
                "threshold": None,
                "emergency_threshold": None,
                "is_cheap": False,
                "is_emergency_cheap": False,
                "span": None,
                "data_points": 0,
                "error": str(e)
            }
        
    # Check if cached statistics are still valid (within TTL)
    def _is_cache_valid(self, now):
        if self._cached_stats is None or self._cache_timestamp is None:
            return False
        
        time_since_cache = (now - self._cache_timestamp).total_seconds()
        return time_since_cache < self._cache_ttl_seconds
    
    # Manually invalidate cache (useful for testing or forced refresh)
    def invalidate_cache(self):
        self._cached_stats = None
        self._cache_timestamp = None