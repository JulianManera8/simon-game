"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Bird, Volume2, Play, RefreshCw } from "lucide-react"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

export default function SimonGame() {
  const [sequence, setSequence] = useState([])
  const [playingSequence, setPlayingSequence] = useState(false)
  const [userSequence, setUserSequence] = useState([])
  const [gameOver, setGameOver] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [level, setLevel] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [isPlayingSound, setIsPlayingSound] = useState(false)
  const [currentPlayingBird, setCurrentPlayingBird] = useState(null)
  const [activeBird, setActiveBird] = useState(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isWinDialogOpen, setIsWinDialogOpen] = useState(false)
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(true)
  const [waitingNextLevel, setWaitingNextLevel] = useState(false)

  const audioRefs = useRef([null, null, null, null])

  // 1 TOPLEFT TERO - ROJO #DA2B24 PRENDIDO / #EB6351 APAGADO
  // 2 TOPRIGHT HORNERO - VERDE #179258 PRENDIDO / #377261 APAGADO
  // 3 BOTTOMLEFT BENTEVEO - AMARILLO #FDCA32 PRENDIDO / #EDB04E APAGADO 
  // 4 BOTTOMRIGHT CARDENAL - AZUL #066FB4 PRENDIDO / #90B3C1 APAGADO

  // TIPOGRAFIA "luckiest guy regular"

  const birds = ["Tero", "Hornero" , "Benteveo", "Cardenal"]
  const birdsImages = ["/images/tero.png", "/images/hornero.png", "/images/benteveo.png", "/images/cardenal.png" ]
  const birdSounds = ["/sounds/tero.mp3", "/sounds/hornero.mp3", "/sounds/benteveo.mp3", "/sounds/cardenal.mp3" ]
  const birdColors = [ "bg-[#EB6351]", "bg-[#377261]", "bg-[#EDB04E]", "bg-[#90B3C1]"]
  const birdActiveColors = ["bg-[#DA2B24]", "bg-[#179258]", "bg-[#FDCA32]", "bg-[#066FB4]"]

  useEffect(() => {
    // Cargar los sonidos
    birdSounds.forEach((sound, index) => {
      const audio = new Audio(sound);
      audio.preload = "auto";
      audioRefs.current[index] = audio;
    })
    
    // Recuperar puntuación máxima del localStorage
    const savedHighScore = localStorage.getItem("simonBirdHighScore");
    if (savedHighScore) {
      setHighScore(Number.parseInt(savedHighScore));
    }

  }, [])

  useEffect(() => {
    if (gameStarted && sequence.length === 0 && !gameOver) {
      addToSequence()
    }
  }, [sequence, gameStarted, gameOver])

  useEffect(() => {
    if (userSequence.length > 0 && sequence.length > 0) {
      const index = userSequence.length - 1
      if (userSequence[index] !== sequence[index]) {
        gameEnd()
        return
      }

      if (userSequence.length === sequence.length) {
        // Nivel de victoria
        if (level + 1 === 6) {
          setIsWinDialogOpen(true)
          return
        }

        if (level > highScore) {
          setHighScore(level)
          localStorage.setItem("simonBirdHighScore", level.toString())
        }

        setWaitingNextLevel(true)
        setTimeout(() => {
          setUserSequence([])
          addToSequence()
          setWaitingNextLevel(false)
        }, 1000)
      }
    }
  }, [userSequence, sequence, level, highScore])


  const playSound = (index) => {
    return new Promise((resolve) => {
      if (!audioRefs.current[index]) {
        resolve()
        return
      }

      setIsPlayingSound(true)
      setCurrentPlayingBird(index)

      const audio = audioRefs.current[index]
      audio.currentTime = 0
      audio.play()

      const handleEnded = () => {
        setIsPlayingSound(false)
        setCurrentPlayingBird(null)
        audio.removeEventListener("ended", handleEnded)
        resolve()
      }

      audio.addEventListener("ended", handleEnded)

      // Limitar la reproducción a 3 segundos máximo
      setTimeout(() => {
        if (!audio.paused) {
          audio.pause()
          audio.currentTime = 0
          setIsPlayingSound(false)
          setCurrentPlayingBird(null)
          resolve()
        }
      }, 1500)
    })
  }

  const highlightBird = async (index) => {
    setActiveBird(index)
    await playSound(index)
    setActiveBird(null)
  }

  const playSequence = async (sequenceToPlay) => {
    setPlayingSequence(true)

    try {
      for (let i = 0; i < sequenceToPlay.length; i++) {
        await highlightBird(sequenceToPlay[i])
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error("Error al reproducir secuencia:", error)
    } finally {
      setPlayingSequence(false)
    }
  }

  const addToSequence = () => {
    const usedCounts = [0, 0, 0, 0]
    sequence.forEach((index) => {
      usedCounts[index]++
    })

    const last = sequence[sequence.length - 1]
    const secondLast = sequence[sequence.length - 2]

    let newBird
    const maxAttempts = 10
    let attempts = 0

    do {
      newBird = Math.floor(Math.random() * 4)
      attempts++
    } while (
      // Evitar 3 veces seguidas
      (last === newBird && secondLast === newBird) ||
      // Si estamos en nivel 3 o más, asegurar que no queden pájaros sin sonar
      (sequence.length >= 3 && usedCounts.includes(0) && usedCounts[newBird] > 0 && attempts < maxAttempts)
    )

    const newSequence = [...sequence, newBird]
    setSequence(newSequence)
    setLevel(newSequence.length)

    setTimeout(() => {
      playSequence(newSequence)
    }, 200)
  }

  const handleBirdClick = async (index) => {
    if (isPlayingSound || playingSequence || gameOver) return

    // Reproducir el sonido y esperar a que termine
    await highlightBird(index)

    // Solo añadir a la secuencia del usuario si el juego ha comenzado
    if (gameStarted && !gameOver) {
      setUserSequence((prev) => [...prev, index])
    }
  }

  const startGame = () => {
  setSequence([])
  setUserSequence([])
  setGameOver(false)
  setGameStarted(true)
  setLevel(0)
  setIsPlayingSound(false)
  setCurrentPlayingBird(null)
  setActiveBird(null)

  audioRefs.current.forEach((audio) => {
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
  })
}

  const gameEnd = () => {
    setGameOver(true)
    setIsDialogOpen(true)
    setGameStarted(false)
    setPlayingSequence(false)

    // Detener cualquier sonido que pueda estar reproduciéndose
    audioRefs.current.forEach((audio) => {
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    })

    // Actualizar puntuación máxima si es necesario
    if (level > highScore) {
      setHighScore(level)
      localStorage.setItem("simonBirdHighScore", level.toString())
    }
  }

  // Determinar si un botón debe estar deshabilitado
  const isButtonDisabled = (birdIndex) => {
    return playingSequence || gameOver || waitingNextLevel || (isPlayingSound && currentPlayingBird !== birdIndex)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-violet-300 to-violet-400">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl luckiest-guy-regular flex items-center justify-center gap-y-2">
            <span className="text-[#066FB4]">SINFONÍA</span>
            <span className="text-[#FDCA32]">DE</span>
            <span className="text-[#DA2B24]">PÁJAROS</span>
          </CardTitle>
        </CardHeader>

        <CardContent>          
        <div className="grid grid-cols-2 gap-4 mb-6">
          {birds.map((name, birdIndex) => (
            <button
              key={birdIndex}
              onClick={() => handleBirdClick(birdIndex)}
              disabled={isButtonDisabled(birdIndex)}
              className={`
                relative
                ${activeBird === birdIndex ? birdActiveColors[birdIndex] : birdColors[birdIndex]}
                h-46 rounded-lg flex flex-col items-center justify-center transition-all duration-300 ease-in-out
                ${playingSequence || isPlayingSound ? (
                  currentPlayingBird === birdIndex
                    ? "scale-105 shadow-lg ring-2 ring-offset-2"
                    : "cursor-not-allowed outline-none"
                ) : "cursor-pointer"}
                focus:outline-none focus:ring-2 focus:ring-offset-2
              `}
              aria-label={`Pájaro ${birdIndex + 1}`}
            >
              <img
                src={birdsImages[birdIndex]}
                alt={name}
                className="h-34 w-full object-contain shadow-md drop-shadow-black/55"
              />
              <p className="font-bold text-white text-sm mt-2">{name}</p>
            </button>
          ))}
        </div>

          <div className="flex justify-center items-center">
            <div className="text-lg font-semibold">Nivel: {level}</div>
            {/* <div className="text-lg font-semibold">Récord: {highScore}</div> */}
          </div>

          {playingSequence && (
            <div className="mt-4 text-center text-sm font-medium text-blue-600">Escuchando secuencia...</div>
          )}

          {gameStarted && !playingSequence && !gameOver && (
            <div className="mt-4 text-center text-sm font-medium text-green-600">
              ¡Tu turno! Repite la secuencia
            </div>
          )}          

        </CardContent>

        <CardFooter className="flex justify-center">
          <Button onClick={startGame} className="w-full cursor-pointer" size="lg" disabled={isPlayingSound || playingSequence}>
            {gameOver ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Jugar de nuevo
              </span>
            ) : (
              <span className="flex items-center mx-auto gap-2">
                <Play className="h-5 w-5" />
                {level === 0 ? "Comenzar juego" : "Reiniciar juego"}
              </span>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Pantalla de Inicio */}
      <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="luckiest-guy-regular">
              <span className="text-lg text-black/80 mr-2">Te damos la bienvenida a</span>
              <span className="text-[#066FB4]">SINFONÍA</span>
              <span className="text-[#FDCA32]">DE</span>
              <span className="text-[#DA2B24]">PÁJAROS</span>
            </DialogTitle>
            <DialogDescription className="text-black/80 font-semibold">
              Memorizá la secuencia de sonidos de los pájaros y repetíla correctamente. ¡Buena suerte!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="bg-violet-700 hover:bg-violet-600 cursor-pointer"
              onClick={() => setIsStartDialogOpen(false)}
            >
              Comenzar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg luckiest-guy-regular text-[#DA2B24]">Perdiste 😔 </DialogTitle>
            <DialogDescription className="text-black/80 font-semibold text-md">
              Te equivocaste en la secuencia. ¿Querés jugar de nuevo?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="bg-violet-700 hover:bg-violet-600 cursor-pointer"
              onClick={() => {
                setIsDialogOpen(false)
                startGame()
              }}
            >
              Jugar de nuevo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWinDialogOpen} onOpenChange={setIsWinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg luckiest-guy-regular text-[#FDCA32]">¡Felicidades! 🎉</DialogTitle>
            <DialogDescription className="text-black/80 font-semibold text-md">
              ¡Completaste el nivel 5, ya sos especialista en canto de pájaros!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="bg-green-600 hover:bg-green-500 cursor-pointer"
              onClick={() => {
                setIsWinDialogOpen(false)
                startGame()
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
