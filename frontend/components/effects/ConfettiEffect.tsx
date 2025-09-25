'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  rotation: number
  size: number
}

export function ConfettiEffect() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const colors = [
      '#FFD700', // Gold
      '#FFA500', // Orange
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#6366F1', // Purple
      '#F472B6', // Pink
      '#10B981', // Green
    ]

    const newParticles: Particle[] = []
    const particleCount = 50

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: window.innerHeight + 20,
        vx: (Math.random() - 0.5) * 10,
        vy: -(Math.random() * 15 + 10),
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        size: Math.random() * 10 + 5
      })
    }

    setParticles(newParticles)

    return () => setParticles([])
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{
            x: particle.x,
            y: particle.y,
            rotate: particle.rotation,
            scale: 1,
            opacity: 1
          }}
          animate={{
            x: particle.x + particle.vx * 100,
            y: particle.y + particle.vy * 100 + 500, // Gravity effect
            rotate: particle.rotation + 720,
            scale: 0,
            opacity: 0
          }}
          transition={{
            duration: 3,
            ease: [0.43, 0.13, 0.23, 0.96]
          }}
          className="absolute"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '0%'
          }}
        />
      ))}
    </div>
  )
}