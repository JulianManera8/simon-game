"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, RefreshCw, VolumeX } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"


export default function SimonGameLogic() {
  const [sequence, setSequence] = useState([])
  const [userSequence, setUserSequence] = useState([])
  const [gameState, setGameState] = useState("idle")
  const [level, setLevel] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [currentPlayingBird, setCurrentPlayingBird] = useState(null)
  const [activeBird, setActiveBird] = useState(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isWinDialogOpen, setIsWinDialogOpen] = useState(false)
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [audioInitialized, setAudioInitialized] = useState(false)

  const audioRefs = useRef([null, null, null, null])
  const timeoutRefs = useRef([null, null, null, null])
  const audioContextRef = useRef(null)

  const birds = ["Tero", "Hornero", "Benteveo", "Cardenal"]
  const birdsImages = ["/images/tero.png", "/images/hornero.png", "/images/benteveo.png", "/images/cardenal.png"]
  const birdSounds = ["/sounds/tero.mp3", "/sounds/hornero.mp3", "/sounds/benteveo.mp3", "/sounds/cardenal.mp3"]
  const birdColors = ["bg-[#EB6351]", "bg-[#377261]", "bg-[#EDB04E]", "bg-[#90B3C1]"]
  const birdActiveColors = ["bg-[#DA2B24]", "bg-[#179258]", "bg-[#FDCA32]", "bg-[#066FB4]"]

  // Función para inicializar audio en móviles
  const initializeAudio = useCallback(async () => {
    if (audioInitialized) return

    try {
      // Crear AudioContext para móviles
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }

      // Resumir AudioContext si está suspendido (requerido en móviles)
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume()
      }

      // Cargar y preparar audios
      const audioPromises = birdSounds.map(async (sound, index) => {
        try {
          const audio = new Audio(sound)
          audio.preload = "auto"
          audio.volume = 0.7 // Volumen más bajo para móviles

          // Configuraciones específicas para móviles
          audio.setAttribute("playsinline", "true")
          audio.setAttribute("webkit-playsinline", "true")

          // Intentar cargar el audio
          await new Promise((resolve, reject) => {
            const handleCanPlay = () => {
              audio.removeEventListener("canplaythrough", handleCanPlay)
              audio.removeEventListener("error", handleError)
              resolve(true)
            }

            const handleError = () => {
              audio.removeEventListener("canplaythrough", handleCanPlay)
              audio.removeEventListener("error", handleError)
              console.warn(`Error cargando audio ${index}`)
              reject(new Error(`Audio ${index} failed to load`))
            }

            audio.addEventListener("canplaythrough", handleCanPlay)
            audio.addEventListener("error", handleError)

            // Timeout para evitar esperas infinitas
            setTimeout(() => {
              handleError()
            }, 5000)
          })

          audioRefs.current[index] = audio
          return true
        } catch (error) {
          console.warn(`Error inicializando audio ${index}:`, error)
          audioRefs.current[index] = null
          return false
        }
      })

      const results = await Promise.allSettled(audioPromises)
      const successCount = results.filter((r) => r.status === "fulfilled" && r.value).length

      if (successCount === 0) {
        setAudioEnabled(false)
        console.warn("No se pudo cargar ningún audio, modo silencioso activado")
      }

      setAudioInitialized(true)
    } catch (error) {
      console.warn("Error inicializando sistema de audio:", error)
      setAudioEnabled(false)
      setAudioInitialized(true)
    }
  }, [audioInitialized])

  useEffect(() => {
    // Recuperar puntuación máxima del localStorage
    const savedHighScore = localStorage.getItem("simonBirdHighScore")
    if (savedHighScore) {
      setHighScore(Number.parseInt(savedHighScore))
    }

    // Cleanup al desmontar
    return () => {
      audioRefs.current.forEach((audio) => {
        if (audio) {
          audio.pause()
          audio.currentTime = 0
        }
      })
      timeoutRefs.current.forEach((timeout) => {
        if (timeout) {
          clearTimeout(timeout)
        }
      })
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Función mejorada para reproducir sonido en móviles
  const playSound = useCallback(
    (index) => {
      return new Promise((resolve) => {
        if (!audioEnabled || !audioRefs.current[index]) {
          // Modo silencioso - solo mostrar visual
          setTimeout(resolve, 600)
          return
        }

        const audio = audioRefs.current[index]

        // Limpiar timeout anterior si existe
        if (timeoutRefs.current[index]) {
          clearTimeout(timeoutRefs.current[index])
          timeoutRefs.current[index] = null
        }

        // Función para limpiar y resolver
        const cleanup = () => {
          setCurrentPlayingBird(null)
          if (timeoutRefs.current[index]) {
            clearTimeout(timeoutRefs.current[index])
            timeoutRefs.current[index] = null
          }
          resolve()
        }

        setCurrentPlayingBird(index)

        try {
          audio.currentTime = 0

          const playPromise = audio.play()

          // Manejar promesa de play (navegadores modernos)
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                // Audio comenzó a reproducirse correctamente
              })
              .catch((error) => {
                console.warn(`Error reproduciendo audio ${index}:`, error)
                cleanup()
              })
          }

          // Event listener para cuando termina el audio
          const handleEnded = () => {
            audio.removeEventListener("ended", handleEnded)
            audio.removeEventListener("error", handleError)
            cleanup()
          }

          // Event listener para errores
          const handleError = () => {
            audio.removeEventListener("ended", handleEnded)
            audio.removeEventListener("error", handleError)
            console.warn(`Error durante reproducción de audio ${index}`)
            cleanup()
          }

          audio.addEventListener("ended", handleEnded)
          audio.addEventListener("error", handleError)

          // Timeout de seguridad
          timeoutRefs.current[index] = setTimeout(() => {
            if (!audio.paused) {
              audio.pause()
              audio.currentTime = 0
            }
            audio.removeEventListener("ended", handleEnded)
            audio.removeEventListener("error", handleError)
            cleanup()
          }, 800)
        } catch (error) {
          console.warn(`Error iniciando reproducción de audio ${index}:`, error)
          cleanup()
        }
      })
    },
    [audioEnabled],
  )

  // Función para resaltar pájaro
  const highlightBird = useCallback(
    async (index) => {
      setActiveBird(index)
      await playSound(index)
      setActiveBird(null)
    },
    [playSound],
  )

  // Función para reproducir secuencia completa
  const playSequence = useCallback(
    async (sequenceToPlay) => {
      setGameState("playing-sequence")

      try {
        for (let i = 0; i < sequenceToPlay.length; i++) {
          await highlightBird(sequenceToPlay[i])
          // Pausa entre sonidos
          if (i < sequenceToPlay.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 400))
          }
        }

        // Pequeña pausa antes de permitir input del usuario
        await new Promise((resolve) => setTimeout(resolve, 600))
        setGameState("waiting-input")
      } catch (error) {
        console.error("Error al reproducir secuencia:", error)
        // Asegurar que el estado se resetee en caso de error
        setCurrentPlayingBird(null)
        setActiveBird(null)
        setGameState("waiting-input")
      }
    },
    [highlightBird],
  )

  // Función para agregar nuevo elemento a la secuencia
  const addToSequence = useCallback(() => {
    let newBird
    const lastBird = sequence[sequence.length - 1]

    // Si estamos en el 5to nivel, verificar que todos los pájaros hayan aparecido
    if (sequence.length === 4) {
      // Contar qué pájaros han aparecido
      const usedBirds = new Set(sequence)
      const missingBirds = [0, 1, 2, 3].filter((bird) => !usedBirds.has(bird))

      if (missingBirds.length > 0) {
        // Si hay pájaros que no han aparecido, elegir uno de ellos
        // pero asegurándonos de que no sea igual al último
        const availableMissingBirds = missingBirds.filter((bird) => bird !== lastBird)

        if (availableMissingBirds.length > 0) {
          // Elegir aleatoriamente entre los pájaros faltantes que no sean el último
          newBird = availableMissingBirds[Math.floor(Math.random() * availableMissingBirds.length)]
        } else {
          // Si todos los pájaros faltantes son iguales al último, elegir cualquier otro
          do {
            newBird = Math.floor(Math.random() * 4)
          } while (newBird === lastBird)
        }
      } else {
        // Si todos los pájaros ya aparecieron, elegir cualquiera excepto el último
        do {
          newBird = Math.floor(Math.random() * 4)
        } while (newBird === lastBird && sequence.length > 0)
      }
    } else {
      // Para niveles 1-4, generar normalmente evitando repeticiones consecutivas
      do {
        newBird = Math.floor(Math.random() * 4)
      } while (newBird === lastBird && sequence.length > 0)
    }

    const newSequence = [...sequence, newBird]
    setSequence(newSequence)
    setLevel(newSequence.length)

    // Reproducir la secuencia después de un breve delay
    setTimeout(() => {
      playSequence(newSequence)
    }, 500)
  }, [sequence, playSequence])

  // Función para manejar click en pájaro
  const handleBirdClick = useCallback(
    async (index) => {
      // Inicializar audio en el primer click (requerido para móviles)
      if (!audioInitialized) {
        await initializeAudio()
      }

      // Solo permitir clicks durante 'waiting-input'
      if (gameState !== "waiting-input") return

      setGameState("processing-input")

      try {
        // Reproducir sonido del pájaro clickeado
        await highlightBird(index)

        // Agregar a la secuencia del usuario
        const newUserSequence = [...userSequence, index]
        setUserSequence(newUserSequence)

        // Verificar si la entrada es correcta
        const currentIndex = newUserSequence.length - 1
        if (newUserSequence[currentIndex] !== sequence[currentIndex]) {
          // Entrada incorrecta - terminar juego
          setGameState("game-over")
          setIsDialogOpen(true)
          return
        }

        // Verificar si completó la secuencia
        if (newUserSequence.length === sequence.length) {
          setGameState("level-complete")

          // Verificar si ganó el juego (nivel 5)
          if (level === 5) {
            setIsWinDialogOpen(true)
            return
          }

          // Actualizar high score si es necesario
          if (level > highScore) {
            const newHighScore = level
            setHighScore(newHighScore)
            localStorage.setItem("simonBirdHighScore", newHighScore.toString())
          }

          // Continuar al siguiente nivel después de una pausa
          setTimeout(() => {
            setUserSequence([])
            addToSequence()
          }, 1000)
        } else {
          // Continuar esperando más input
          setGameState("waiting-input")
        }
      } catch (error) {
        console.error("Error en handleBirdClick:", error)
        setGameState("waiting-input")
      }
    },
    [
      gameState,
      userSequence,
      sequence,
      level,
      highScore,
      highlightBird,
      addToSequence,
      audioInitialized,
      initializeAudio,
    ],
  )

  // Función para iniciar juego
  const startGame = useCallback(async () => {
    // Inicializar audio en el primer click (requerido para móviles)
    if (!audioInitialized) {
      await initializeAudio()
    }

    // Detener cualquier audio que esté reproduciéndose y limpiar timeouts
    audioRefs.current.forEach((audio, index) => {
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
      if (timeoutRefs.current[index]) {
        clearTimeout(timeoutRefs.current[index])
        timeoutRefs.current[index] = null
      }
    })

    // Resetear COMPLETAMENTE todo el estado
    setSequence([])
    setUserSequence([])
    setLevel(0)
    setGameState("idle")
    setCurrentPlayingBird(null)
    setActiveBird(null)
    setIsDialogOpen(false)
    setIsWinDialogOpen(false)

    // Iniciar primer nivel después de un delay más largo para asegurar el reset
    setTimeout(() => {
      addToSequence()
    }, 800)
  }, [addToSequence, audioInitialized, initializeAudio])

  // Determinar si un botón debe estar deshabilitado
  const isButtonDisabled = useCallback(
    (birdIndex) => {
      return gameState !== "waiting-input" || (currentPlayingBird !== null && currentPlayingBird !== birdIndex)
    },
    [gameState, currentPlayingBird],
  )

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-[#87367b8e] to-[#87367b6a] select-none">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl luckiest-guy-regular flex items-center justify-center gap-y-2">
            <span className="text-[#066FB4]">SINFONÍA</span>
            <span className="text-[#FDCA32]">DE</span>
            <span className="text-[#DA2B24]">PÁJAROS</span>
          </CardTitle>
          {!audioEnabled && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mt-2">
              <VolumeX className="h-4 w-4" />
              <span>Modo silencioso</span>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {birds.map((name, birdIndex) => (
              <button
                key={birdIndex}
                onClick={() => handleBirdClick(birdIndex)}
                onTouchStart={() => {}} // Mejorar respuesta táctil
                disabled={isButtonDisabled(birdIndex)}
                className={`
                  relative h-42 rounded-lg flex flex-col items-center justify-center transition-all duration-200 ease-in-out
                  ${activeBird === birdIndex ? birdActiveColors[birdIndex] : birdColors[birdIndex]}
                  ${
                    gameState === "waiting-input" && !isButtonDisabled(birdIndex)
                      ? "cursor-pointer hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2"
                      : "cursor-not-allowed opacity-75"
                  }
                  ${activeBird === birdIndex ? "scale-105 shadow-lg ring-2 ring-offset-2" : ""}
                  touch-manipulation
                `}
                aria-label={`Pájaro ${name}`}
              >
                <img
                  src={birdsImages[birdIndex] || "/placeholder.svg"}
                  alt={name}
                  className="h-30 w-full object-contain pointer-events-none"
                />
                <p className="font-bold text-white text-sm mt-2 pointer-events-none">{name}</p>
              </button>
            ))}
          </div>

          <div className="flex justify-center items-center mb-4">
            <div className="text-lg font-semibold">Nivel: {level}</div>
          </div>

          {gameState === "playing-sequence" && (
            <div className="text-center text-sm font-medium text-blue-600">Escuchando secuencia...</div>
          )}

          {gameState === "waiting-input" && (
            <div className="text-center text-sm font-medium text-green-600">
              ¡Tu turno! Repite la secuencia ({userSequence.length + 1}/{sequence.length})
            </div>
          )}

          {gameState === "processing-input" && (
            <div className="text-center text-sm font-medium text-yellow-600">Procesando...</div>
          )}

          {gameState === "level-complete" && (
            <div className="text-center text-sm font-medium text-purple-600">
              ¡Nivel completado! Preparando siguiente nivel...
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <Button
            onClick={gameState === "game-over" || level > 0 ? () => window.location.reload() : startGame}
            className="w-full bg-[#87367B] hover:bg-[#7c3e73] active:bg-[#6d2f63] cursor-pointer touch-manipulation"
            size="lg"
            disabled={gameState === "playing-sequence" || gameState === "processing-input"}
          >
            {gameState === "game-over" || level > 0 ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Jugar de nuevo
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Comenzar juego
              </span>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Pantalla de Inicio */}
      <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold luckiest-guy-regular">
              <span className="text-lg text-black/80 mr-2">Te damos la bienvenida a</span>
              <span className="text-[#066FB4]">SINFONÍA </span>
              <span className="text-[#FDCA32]">DE </span>
              <span className="text-[#DA2B24]">PÁJAROS</span>
            </DialogTitle>
            <DialogDescription className="text-black/80 font-semibold">
              Memorizá la secuencia de sonidos de los pájaros y repetíla correctamente.
              {!audioInitialized && (
                <span className="block mt-2 text-sm text-gray-600">
                  Nota: En dispositivos móviles, toca "Comenzar" para activar el audio.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="bg-[#87367B] hover:bg-[#7c3e73] cursor-pointer touch-manipulation"
              onClick={() => setIsStartDialogOpen(false)}
            >
              Comenzar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Game Over */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#DA2B24] luckiest-guy-regular">¡Perdiste! 😔</DialogTitle>
            <DialogDescription className="text-black/80 font-semibold text-md">
              Te equivocaste en la secuencia. Llegaste al nivel {level}. ¿Querés jugar de nuevo?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="bg-[#87367B] hover:bg-[#7c3e73] cursor-pointer touch-manipulation"
              onClick={() => {
                setIsDialogOpen(false)
                window.location.reload()
              }}
            >
              Jugar de nuevo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Victoria */}
      <Dialog open={isWinDialogOpen} onOpenChange={setIsWinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#e4ae0b] luckiest-guy-regular">
              ¡Felicidades! 🎉
            </DialogTitle>
            <DialogDescription className="text-black/80 font-semibold text-md">
              ¡Completaste el nivel 5, ya sos especialista en canto de pájaros!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="bg-[#87367B] hover:bg-[#7c3e73] cursor-pointer touch-manipulation"
              onClick={() => {
                setIsWinDialogOpen(false)
                window.location.reload()
              }}
            >
              Jugar de nuevo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
