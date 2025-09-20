import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

interface RateLimitEntry {
  count: number
  resetTime: number
}

class RateLimiter {
  private cache = new Map<string, RateLimitEntry>()
  private windowMs: number
  private maxRequests: number

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests

    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.resetTime) {
        this.cache.delete(key)
      }
    }
  }

  private getKey(req: Request): string {
    // Use IP address as the key
    return req.ip || req.connection.remoteAddress || 'unknown'
  }

  public middleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = this.getKey(req)
    const now = Date.now()
    const resetTime = now + this.windowMs

    let entry = this.cache.get(key)

    if (!entry || now > entry.resetTime) {
      // Create new entry
      entry = { count: 1, resetTime }
      this.cache.set(key, entry)
    } else {
      // Increment existing entry
      entry.count++
    }

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': this.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, this.maxRequests - entry.count).toString(),
      'X-RateLimit-Reset': new Date(entry.resetTime).toISOString(),
    })

    if (entry.count > this.maxRequests) {
      logger.warn(`Rate limit exceeded for IP: ${key}`, {
        ip: key,
        count: entry.count,
        limit: this.maxRequests,
        userAgent: req.get('User-Agent'),
      })

      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
      })
      return
    }

    next()
  }
}

// Create different rate limiters for different endpoints
export const generalLimiter = new RateLimiter(15 * 60 * 1000, 100) // 100 requests per 15 minutes
export const uploadLimiter = new RateLimiter(15 * 60 * 1000, 10) // 10 uploads per 15 minutes
export const strictLimiter = new RateLimiter(60 * 1000, 5) // 5 requests per minute

export const rateLimiter = generalLimiter.middleware