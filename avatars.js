        // Gestor de recursos multimedia - Controla qué WebP y audio se reproduce
        const MediaManager = (() => {
            let currentActiveAudio = null;
            let currentActiveWebP = null;
            
            // Pausar todos los audios excepto el especificado
            function pauseAllAudio(exceptAudio = null) {
                document.querySelectorAll('audio:not(#backgroundMusic)').forEach(audio => {
                    if (audio !== exceptAudio && !audio.paused) {
                        audio.pause();
                        audio.currentTime = 0;
                    }
                });
            }
            
            // Ocultar todos los WebP animados excepto el especificado
            function hideAllWebP(exceptWebP = null) {
                document.querySelectorAll('.avatar-image:not(#avatarImageSleep)').forEach(webp => {
                    if (webp !== exceptWebP && webp.style.display !== 'none') {
                        webp.style.display = 'none';
                    }
                });
                
                document.querySelectorAll('.overlay-webp').forEach(webp => {
                    if (webp !== exceptWebP && webp.parentElement.classList.contains('visible')) {
                        webp.parentElement.classList.remove('visible');
                        webp.src = '';
                    }
                });
            }
            
            // Reproducir un audio específico con su WebP
            function playAudio(audioElement, webpElement, audioSrc = null, webpSrc = null) {
                if (!audioElement || !webpElement) return;
                
                // Pausar cualquier audio que esté reproduciéndose
                pauseAllAudio(audioElement);
                hideAllWebP(webpElement);
                
                // Si se proporciona una nueva fuente, cambiarla
                if (audioSrc && audioElement.dataset.src !== audioSrc) {
                    audioElement.dataset.src = audioSrc;
                    ensureSrcLoaded(audioElement);
                }
                
                if (webpSrc && webpElement.dataset.src !== webpSrc) {
                    webpElement.dataset.src = webpSrc;
                    ensureSrcLoaded(webpElement);
                }
                
                // Mostrar el WebP
                if (webpElement.classList.contains('avatar-image')) {
                    webpElement.style.display = 'block';
                    webpElement.classList.add('active');
                } else {
                    webpElement.parentElement.classList.add('visible');
                }
                
                // Reproducir el audio
                const playPromise = audioElement.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.error("Error al reproducir audio:", e);
                        // Mostrar micro-alerta si hay error de política de autoplay
                        if (e.name === 'NotAllowedError') {
                            showMicroAlert();
                        }
                    });
                }
                
                currentActiveAudio = audioElement;
                currentActiveWebP = webpElement;
            }
            
            // Cargar recursos pero no reproducirlos
            function loadResources(audioElement, webpElement, audioSrc, webpSrc) {
                if (!audioElement || !webpElement) return;
                
                if (audioSrc && audioElement.dataset.src !== audioSrc) {
                    audioElement.dataset.src = audioSrc;
                    ensureSrcLoaded(audioElement);
                }
                
                if (webpSrc && webpElement.dataset.src !== webpSrc) {
                    webpElement.dataset.src = webpSrc;
                    ensureSrcLoaded(webpElement);
                }
            }
            
            return {
                pauseAllAudio,
                hideAllWebP,
                playAudio,
                loadResources,
                getCurrentActiveAudio: () => currentActiveAudio,
                getCurrentActiveWebP: () => currentActiveWebP
            };
        })();

        // audio.js - Reproductor principal actualizado para WebP y MP3
        const AudioPlayer = (() => {
            // Elementos DOM
            const elements = {
                audioPlayer: document.querySelector('.audio-player'),
                expandButton: document.querySelector('.expand-button'),
                playButtonMain: document.querySelector('.play-button-main'),
                progressFill: document.querySelector('.progress-fill'),
                timeDisplay: document.querySelector('.time-display'),
                backgroundMusic: document.getElementById('backgroundMusic'),
                prevButton: document.querySelector('.prev'),
                nextButton: document.querySelector('.next'),
                musicButton: document.querySelector('.music-button'),
                progressBar: document.querySelector('.progress-bar'),
                narratorControl: document.querySelector('.narrator-control'),
                narratorsButton: document.querySelector('.narrators-button'),
                narratorOptions: document.querySelectorAll('.narrator-option'),
                playerClosed: document.querySelector('.player-closed'),
                eqBars: document.querySelectorAll('.eq-bar'),
                avatarImageSleep: document.getElementById('avatarImageSleep'),
                avatarImageSpeak: document.getElementById('avatarImageSpeak'),
                microAlert: document.getElementById('microAlert')
            };

            // Datos de los narradores - ACTUALIZADO para WebP y MP3
            const narratorData = {
                1: {
                    name: 'Nara',
                    sleep: 'webp/nara-espera.webp',
                    preview: 'webp/nara-espera.webp',
                    hasVoice: true,
                    audioSequence: [
                        'audio/nara-intro.mp3',
                        'audio/nara-speak01.mp3',
                        'audio/nara-speak02.mp3'
                    ],
                    webpSequence: [
                        'webp/nara-speak02.webp',
                        'webp/nara-speak02.webp',
                        'webp/nara-speak02.webp'
                    ]
                },
                2: {
                    name: 'Mimi',
                    sleep: 'webp/mimi-espera.webp',
                    preview: 'webp/mimi-espera.webp',
                    hasVoice: true,
                    audioSequence: [
                        'audio/mimi-intro.mp3',
                        'audio/mimi-speak01.mp3',
                        'audio/mimi-speak02.mp3',
                        'audio/mimi-speak03.mp3'
                    ],
                    webpSequence: [
                        'webp/mimi-intro.webp',
                        'webp/mimi-intro.webp',
                        'webp/mimi-intro.webp',
                        'webp/mimi-intro.webp'
                    ]
                },
                3: {
                    name: 'Vid',
                    sleep: 'webp/vid-espera.webp',
                    preview: 'webp/vid-espera.webp',
                    hasVoice: false,
                    audioSequence: [],
                    webpSequence: []
                },
                4: {
                    name: 'Ava',
                    sleep: 'webp/ava-espera.webp',
                    preview: 'webp/ava-espera.webp',
                    hasVoice: false,
                    audioSequence: [],
                    webpSequence: []
                }
            };

            // Estado
            const state = {
                isExpanded: false,
                isNarratorPlaying: false,
                isMusicPlaying: false,
                currentNarratorId: 1,
                currentAudioIndex: 0,
                dragStartPos: { x: 0, y: 0 },
                isDragging: false,
                isHiddenByContainer: false,
                // Elementos de audio para el avatar principal
                avatarAudio: new Audio(),
                // Elementos de audio para contenedores (se crearán dinámicamente)
                containerAudios: []
            };

            // Inicialización
            function init() {
                // Configurar el audio del avatar
                state.avatarAudio.preload = 'none';
                
                setupEventListeners();
                changeNarrator(state.currentNarratorId, false);
                
                // Posicionar el reproductor en la esquina superior derecha
                positionPlayerTopRight();
            }

            // Posicionamiento inicial correcto
            function positionPlayerTopRight() {
                const margin = 20;
                elements.audioPlayer.style.right = margin + 'px';
                elements.audioPlayer.style.top = margin + 'px';
                elements.audioPlayer.style.left = 'auto';
                elements.audioPlayer.style.bottom = 'auto';
            }

            function setupEventListeners() {
                // controles principales
                elements.playButtonMain.addEventListener('click', toggleNarratorPlayback);
                elements.prevButton.addEventListener('click', () => navigateSequence('prev'));
                elements.nextButton.addEventListener('click', () => navigateSequence('next'));

                // Detección de clic vs arrastre
                elements.playerClosed.addEventListener('mousedown', (e) => {
                    state.dragStartPos.x = e.clientX;
                    state.dragStartPos.y = e.clientY;
                    state.isDragging = false;
                });

                elements.playerClosed.addEventListener('mouseup', (e) => {
                    if (!state.isDragging) {
                        const deltaX = Math.abs(e.clientX - state.dragStartPos.x);
                        const deltaY = Math.abs(e.clientY - state.dragStartPos.y);
                        // Si el cursor se movió menos de 5px, se considera un clic
                        if (deltaX < 5 && deltaY < 5) {
                            toggleNarratorPlayback();
                        }
                    }
                    state.isDragging = false;
                });

                // eventos del audio del avatar
                state.avatarAudio.addEventListener('ended', handleAudioEnded);
                state.avatarAudio.addEventListener('timeupdate', updateProgress);

                // selector de narrador
                elements.narratorOptions.forEach(option => {
                    option.addEventListener('click', function() {
                        const newNarratorId = parseInt(this.getAttribute('data-narrator'), 10);
                        if (newNarratorId !== state.currentNarratorId) {
                            changeNarrator(newNarratorId);
                        }
                        elements.narratorControl.classList.remove('is-open');
                    });
                });

                // controles varios
                elements.musicButton.addEventListener('click', toggleBackgroundMusic);
                elements.progressBar.addEventListener('click', seekAudio);
                elements.expandButton.addEventListener('click', toggleExpand);
                elements.narratorsButton.addEventListener('click', toggleNarratorSelector);

                // Cerrar expansión al hacer clic fuera
                document.addEventListener('click', function(e) {
                    if (state.isExpanded &&
                        !elements.audioPlayer.contains(e.target) &&
                        !elements.expandButton.contains(e.target)) {
                        toggleExpand();
                    }

                    // Cerrar selector de narradores al hacer clic fuera
                    if (elements.narratorControl.classList.contains('is-open') &&
                        !e.target.closest('.narrator-control')) {
                        elements.narratorControl.classList.remove('is-open');
                    }
                });
            }

            // Reproducir audio actual (narrador)
            function playCurrentAudio() {
                // Detener cualquier reproducción de contenedores
                if (window.ContentContainers && typeof window.ContentContainers.stopAll === 'function') {
                    try { window.ContentContainers.stopAll(); } catch (e) { /* ignore */ }
                }

                const narrator = narratorData[state.currentNarratorId];
                if (!narrator || narrator.audioSequence.length === 0) {
                    // Mostrar advertencia si el avatar no tiene voz
                    if (!narrator.hasVoice) {
                        showMicroAlert("Este avatar no tiene audio disponible");
                    }
                    stopPlayback();
                    return;
                }

                if (state.currentAudioIndex >= narrator.audioSequence.length) {
                    state.currentAudioIndex = narrator.audioSequence.length - 1;
                } else if (state.currentAudioIndex < 0) {
                    state.currentAudioIndex = 0;
                }

                // Ocultar imagen de espera y mostrar imagen de habla
                elements.avatarImageSleep.classList.remove('active');

                // Cargar y reproducir el audio y WebP correspondientes
                const audioSrc = narrator.audioSequence[state.currentAudioIndex];
                const webpSrc = narrator.webpSequence[state.currentAudioIndex];
                
                MediaManager.playAudio(state.avatarAudio, elements.avatarImageSpeak, audioSrc, webpSrc);
                elements.avatarImageSpeak.classList.add('active');

                elements.playerClosed.classList.add('speaking');
                updatePlayButtons();
            }

            // Detener reproducción del narrador
            function stopPlayback() {
                state.isNarratorPlaying = false;
                state.currentAudioIndex = 0;

                elements.avatarImageSpeak.classList.remove('active');
                elements.avatarImageSpeak.style.display = 'none';
                try { state.avatarAudio.pause(); } catch (e) {}
                state.avatarAudio.currentTime = 0;
                
                // Reactivar imagen de espera
                elements.avatarImageSleep.classList.add('active');

                elements.playerClosed.classList.remove('speaking');
                updatePlayButtons();

                if (elements.progressFill) elements.progressFill.style.width = '0%';
                if (elements.timeDisplay) elements.timeDisplay.textContent = '0:00';
            }

            // toggle play/pause narrador
            function toggleNarratorPlayback() {
                // Mostrar advertencia si el avatar no tiene voz
                const narrator = narratorData[state.currentNarratorId];
                if (!narrator.hasVoice) {
                    showMicroAlert("Este avatar no tiene audio disponible");
                    return;
                }
                
                state.isNarratorPlaying = !state.isNarratorPlaying;

                if (state.isNarratorPlaying) {
                    playCurrentAudio();
                } else {
                    try { state.avatarAudio.pause(); } catch (e) {}
                    elements.playerClosed.classList.remove('speaking');
                    
                    // Reactivar imagen de espera
                    elements.avatarImageSleep.classList.add('active');
                    elements.avatarImageSpeak.style.display = 'none';
                }
                updatePlayButtons();
            }

            // navegación
            function navigateSequence(direction) {
                const narrator = narratorData[state.currentNarratorId];
                if (!narrator) return;

                if (direction === 'next') {
                    state.currentAudioIndex++;
                    if (state.currentAudioIndex >= narrator.audioSequence.length) {
                        state.currentAudioIndex = narrator.audioSequence.length - 1;
                    }
                } else if (direction === 'prev') {
                    state.currentAudioIndex--;
                    if (state.currentAudioIndex < 0) {
                        state.currentAudioIndex = 0;
                    }
                }

                if (state.isNarratorPlaying) {
                    playCurrentAudio();
                }
            }

            // Cambiar narrador
            function changeNarrator(narratorId, startPlaying = false) {
                // Detener reproducción actual
                MediaManager.pauseAllAudio();
                MediaManager.hideAllWebP();
                
                state.isNarratorPlaying = startPlaying;
                state.currentNarratorId = narratorId;
                state.currentAudioIndex = 0;

                // Actualizar selectores
                elements.narratorOptions.forEach(opt => {
                    opt.classList.remove('active');
                    opt.classList.remove('in-use');
                    if (parseInt(opt.getAttribute('data-narrator'), 10) === narratorId) {
                        opt.classList.add('in-use');
                    }
                });
                
                const selector = document.querySelector(`[data-narrator="${narratorId}"]`);
                if (selector) selector.classList.add('active');

                const narrator = narratorData[narratorId];
                if (narrator) {
                    // Actualizar imagen de espera
                    elements.avatarImageSleep.src = narrator.sleep;
                    
                    // Detener cualquier reproducción actual
                    stopPlayback();
                }

                if (startPlaying) {
                    playCurrentAudio();
                }

                elements.narratorControl.classList.remove('is-open');
                if (state.isExpanded) {
                    toggleExpand();
                }
            }

            function handleAudioEnded() {
                stopPlayback();
            }

            function updateProgress() {
                const { currentTime, duration } = state.avatarAudio;
                if (duration > 0) {
                    const percent = (currentTime / duration) * 100;
                    elements.progressFill.style.width = `${percent}%`;
                    const currentMins = Math.floor(currentTime / 60);
                    const currentSecs = Math.floor(currentTime % 60).toString().padStart(2, '0');
                    elements.timeDisplay.textContent = `${currentMins}:${currentSecs}`;
                }
            }

            function seekAudio(e) {
                const rect = this.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percent = clickX / rect.width;
                if (state.avatarAudio.duration) {
                    state.avatarAudio.currentTime = percent * state.avatarAudio.duration;
                }
            }

            // Función de música de fondo
            function toggleBackgroundMusic() {
                state.isMusicPlaying = !state.isMusicPlaying;
                if (state.isMusicPlaying) {
                    elements.backgroundMusic.play().catch(e => console.error("Error al reproducir música:", e));
                    elements.musicButton.classList.add('active');
                    elements.musicButton.classList.remove('muted');
                } else {
                    elements.backgroundMusic.pause();
                    elements.musicButton.classList.remove('active');
                    elements.musicButton.classList.add('muted');
                }
            }

            function toggleNarratorSelector() {
                // Detectar posición y ajustar dirección del selector
                const narratorControl = elements.narratorControl;
                const audioPlayer = elements.audioPlayer;
                const rect = audioPlayer.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                
                // Si el reproductor está en la mitad inferior de la pantalla, abrir hacia arriba
                if (rect.bottom > windowHeight * 0.6) {
                    narratorControl.classList.add('open-upward');
                } else {
                    narratorControl.classList.remove('open-upward');
                }
                
                narratorControl.classList.toggle('is-open');
            }

            // expandir/contraer
            function toggleExpand(e) {
                if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

                state.isExpanded = !state.isExpanded;
                elements.audioPlayer.classList.toggle('expanded', state.isExpanded);

                if (state.isExpanded) {
                    elements.playerClosed.style.display = 'none';
                    // Al expandir, se centra
                    elements.audioPlayer.classList.add('player-centered');
                } else {
                    elements.playerClosed.style.display = '';
                    // Al contraer, se quita el centrado para que vuelva a su posición de arrastre
                    elements.audioPlayer.classList.remove('player-centered');
                }
            }

            function updatePlayButtons() {
                const playButtonMain = elements.playButtonMain;
                if (!playButtonMain) return;
                if (state.isNarratorPlaying) {
                    playButtonMain.classList.add('playing');
                } else {
                    playButtonMain.classList.remove('playing');
                }
            }

            function getCurrentNarrator() {
                return narratorData[state.currentNarratorId];
            }

            function stop() {
                stopPlayback();
            }

            // Función para ocultar el avatar principal
            function hideAvatar() {
                if (!state.isHiddenByContainer) {
                    elements.audioPlayer.style.opacity = '0';
                    elements.audioPlayer.style.pointerEvents = 'none';
                    state.isHiddenByContainer = true;
                }
            }

            // Función para mostrar el avatar principal
            function showAvatar() {
                if (state.isHiddenByContainer) {
                    elements.audioPlayer.style.opacity = '1';
                    elements.audioPlayer.style.pointerEvents = 'auto';
                    state.isHiddenByContainer = false;
                }
            }

            // Mejorar carga de recursos
            function ensureSrcLoaded(element) {
                if (!element) return;
                const ds = element.dataset && element.dataset.src;
                if (!ds) return;
                if (element.getAttribute('data-loaded') === 'true' && element.src === ds) return;
                element.src = ds;
                element.setAttribute('data-loaded', 'true');
            }

            // Mostrar micro-alerta
            function showMicroAlert(message = "Toca de nuevo para escuchar") {
                elements.microAlert.textContent = message;
                elements.microAlert.classList.add('show');
                
                setTimeout(() => {
                    elements.microAlert.classList.remove('show');
                }, 3000);
            }

            init();

            return {
                getCurrentNarrator,
                stop,
                hideAvatar,
                showAvatar,
                showMicroAlert,
                state
            };
        })();

        // Módulo para gestionar los contenedores de contenido
        const ContentContainers = (() => {
            const containers = document.querySelectorAll('.content-container');
            let activeContainer = null;

            function init() {
                containers.forEach(container => {
                    const playBtn = container.querySelector('.container-play-btn');
                    const webpOverlay = container.querySelector('.overlay-webp');
                    const audioIndex = parseInt(playBtn.getAttribute('data-audio-index'), 10);
                    
                    // Crear elemento de audio para este contenedor
                    const audioElement = new Audio();
                    audioElement.preload = 'none';
                    container.audioElement = audioElement;
                    
                    // Evento click para reproducir
                    playBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        
                        // Si ya es el contenedor activo, detener la reproducción
                        if (activeContainer === container) {
                            stopContainer(container);
                            activeContainer = null;
                            // Mostrar el avatar principal
                            AudioPlayer.showAvatar();
                            return;
                        }
                        
                        // Detener cualquier contenedor que esté reproduciendo
                        if (activeContainer) {
                            stopContainer(activeContainer);
                        }
                        
                        // Detener el reproductor principal
                        AudioPlayer.stop();
                        
                        // Ocultar el avatar principal
                        AudioPlayer.hideAvatar();
                        
                        // Reproducir este contenedor
                        playContainer(container, audioIndex);
                        activeContainer = container;
                    });
                    
                    // Permitir pausar el audio haciendo clic en el contenedor
                    const overlayContainer = container.querySelector('.webp-overlay-container');
                    overlayContainer.addEventListener('click', (e) => {
                        if (activeContainer === container) {
                            if (!container.audioElement.paused) {
                                container.audioElement.pause();
                                container.classList.remove('playing');
                                container.querySelector('.container-play-btn i').classList.remove('fa-pause');
                                container.querySelector('.container-play-btn i').classList.add('fa-play');
                                container.querySelector('.audio-indicator span').textContent = 'Contenido pausado';
                            } else {
                                container.audioElement.play().catch(e => {
                                    console.error("Error al reanudar audio:", e);
                                    AudioPlayer.showMicroAlert();
                                });
                                container.classList.add('playing');
                                container.querySelector('.container-play-btn i').classList.remove('fa-play');
                                container.querySelector('.container-play-btn i').classList.add('fa-pause');
                                container.querySelector('.audio-indicator span').textContent = 'Reproduciendo contenido';
                            }
                            e.stopPropagation();
                        }
                    });
                    
                    // Evento cuando termina el audio
                    audioElement.addEventListener('ended', () => {
                        stopContainer(container);
                        // Mostrar el avatar principal al terminar el audio
                        AudioPlayer.showAvatar();
                        activeContainer = null;
                    });
                    
                    // Evento para actualizar la barra de progreso
                    audioElement.addEventListener('timeupdate', function() {
                        const progressFill = container.querySelector('.progress-fill');
                        if (progressFill && audioElement.duration) {
                            const percent = (audioElement.currentTime / audioElement.duration) * 100;
                            progressFill.style.width = `${percent}%`;
                        }
                    });
                });
            }

            // Reproducir contenedor
            function playContainer(container, audioIndex) {
                const narrator = AudioPlayer.getCurrentNarrator();
                const webpOverlay = container.querySelector('.overlay-webp');
                const overlayContainer = container.querySelector('.webp-overlay-container');
                const playBtn = container.querySelector('.container-play-btn');
                const audioIndicator = container.querySelector('.audio-indicator');
                const audioElement = container.audioElement;
                
                // Verificar si el avatar tiene voz
                if (!narrator.hasVoice) {
                    AudioPlayer.showMicroAlert("Este avatar no tiene audio disponible");
                    AudioPlayer.showAvatar();
                    return;
                }
                
                if (!narrator || !narrator.audioSequence || audioIndex > narrator.audioSequence.length) {
                    console.error("No hay audio disponible para este índice:", audioIndex);
                    return;
                }
                
                // Usar índice correcto (audioIndex - 1 porque es base 1)
                const actualIndex = Math.min(audioIndex - 1, narrator.audioSequence.length - 1);
                const audioSrc = narrator.audioSequence[actualIndex];
                const webpSrc = narrator.webpSequence[actualIndex];
                
                console.log('Reproduciendo audio:', audioSrc, 'para contenedor con índice:', audioIndex);
                
                // Cargar y reproducir los recursos
                MediaManager.playAudio(audioElement, webpOverlay, audioSrc, webpSrc);
                overlayContainer.classList.add('visible');
                container.classList.add('playing');
                playBtn.querySelector('i').classList.remove('fa-play');
                playBtn.querySelector('i').classList.add('fa-pause');
                audioIndicator.querySelector('span').textContent = 'Reproduciendo contenido';
            }

            function stopContainer(container) {
                const webpOverlay = container.querySelector('.overlay-webp');
                const overlayContainer = container.querySelector('.webp-overlay-container');
                const playBtn = container.querySelector('.container-play-btn');
                const audioIndicator = container.querySelector('.audio-indicator');
                const audioElement = container.audioElement;
                
                if (!audioElement.paused) {
                    audioElement.pause();
                }
                audioElement.currentTime = 0;
                overlayContainer.classList.remove('visible');
                container.classList.remove('playing');
                playBtn.querySelector('i').classList.remove('fa-pause');
                playBtn.querySelector('i').classList.add('fa-play');
                audioIndicator.querySelector('span').textContent = 'Contenido pausado';
                
                // Limpiar el WebP
                webpOverlay.src = '';
            }

            function stopAll() {
                if (activeContainer) {
                    stopContainer(activeContainer);
                    activeContainer = null;
                }
            }

            init();

            return {
                stopAll
            };
        })();

        // Módulo para arrastrar el reproductor
        (function() {
            'use strict';
            
            const player = document.querySelector('.audio-player');
            const playerClosed = document.querySelector('.player-closed');
            let isDragging = false;
            let startX, startY, initialLeft, initialTop;

            function startDrag(e) {
                // Solo arrastrar desde el avatar cerrado
                if (!e.target.closest('.player-closed')) return;
                
                // Obtener posición inicial
                const rect = player.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;
                
                // Registrar punto de inicio del arrastre
                startX = e.clientX;
                startY = e.clientY;
                
                // Preparar para posible arrastre
                isDragging = false;
                
                // Prevenir selección de texto durante el arrastre
                e.preventDefault();
            }

            function duringDrag(e) {
                const deltaX = Math.abs(e.clientX - startX);
                const deltaY = Math.abs(e.clientY - startY);
                
                // Si se mueve más de 5px, iniciar arrastre
                if (!isDragging && (deltaX > 5 || deltaY > 5)) {
                    isDragging = true;
                    player.classList.add('dragging');
                    if (window.AudioPlayer && window.AudioPlayer.state) {
                        window.AudioPlayer.state.isDragging = true;
                    }
                }
                
                if (!isDragging) return;
                
                // Calcular nueva posición
                let newX = initialLeft + (e.clientX - startX);
                let newY = initialTop + (e.clientY - startY);
                
                // Limitar la posición para que no salga de la pantalla (con margen de seguridad)
                const margin = 20;
                const maxX = window.innerWidth - player.offsetWidth - margin;
                const maxY = window.innerHeight - player.offsetHeight - margin;
                
                newX = Math.max(margin, Math.min(newX, maxX));
                newY = Math.max(margin, Math.min(newY, maxY));
                
                // Aplicar nueva posición
                player.style.left = `${newX}px`;
                player.style.top = `${newY}px`;
                player.style.right = 'auto';
                player.style.bottom = 'auto';
            }

            function stopDrag() {
                if (isDragging) {
                    player.classList.remove('dragging');
                    
                    // Guardar la posición final para persistencia
                    initialLeft = parseInt(player.style.left) || 0;
                    initialTop = parseInt(player.style.top) || 0;
                }
                
                isDragging = false;
                
                // Limpiar estado de arrastre en AudioPlayer
                if (window.AudioPlayer && window.AudioPlayer.state) {
                    window.AudioPlayer.state.isDragging = false;
                }
            }

            // Event listeners para mouse
            document.addEventListener('mousedown', startDrag);
            document.addEventListener('mousemove', duringDrag);
            document.addEventListener('mouseup', stopDrag);

            // Event listeners para touch
            document.addEventListener('touchstart', (e) => {
                startDrag(e.touches[0]);
            });
            document.addEventListener('touchmove', (e) => {
                duringDrag(e.touches[0]);
                e.preventDefault(); // Prevenir scroll en dispositivos móviles
            });
            document.addEventListener('touchend', stopDrag);
        })();

        // Helper function para cargar recursos
        function ensureSrcLoaded(element) {
            if (!element) return;
            const ds = element.dataset && element.dataset.src;
            if (!ds) return;
            if (element.getAttribute('data-loaded') === 'true' && element.src === ds) return;
            element.src = ds;
            element.setAttribute('data-loaded', 'true');
        }