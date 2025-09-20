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
                        webp.src = ''; // Limpiar src para detener la animación
                    }
                });
            }
            
            // Reproducir un audio específico con su WebP
            function playAudio(audioElement, webpElement, audioSrc = null, webpSrc = null) {
                if (!audioElement || !webpElement) return;
                
                pauseAllAudio(audioElement);
                hideAllWebP(webpElement);
                
                if (audioSrc && audioElement.src !== audioSrc) {
                    audioElement.src = audioSrc;
                }
                
                if (webpSrc) {
                    webpElement.src = webpSrc;
                }
                
                if (webpElement.classList.contains('avatar-image')) {
                    webpElement.style.display = 'block';
                    webpElement.classList.add('active');
                } else {
                    webpElement.parentElement.classList.add('visible');
                }
                
                const playPromise = audioElement.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.error("Error al reproducir audio:", e);
                        if (e.name === 'NotAllowedError') {
                            AudioPlayer.showMicroAlert();
                        }
                    });
                }
                
                currentActiveAudio = audioElement;
                currentActiveWebP = webpElement;
            }
            
            return {
                pauseAllAudio,
                hideAllWebP,
                playAudio
            };
        })();

        // audio.js - Reproductor principal
        const AudioPlayer = (() => {
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
                avatarImageSleep: document.getElementById('avatarImageSleep'),
                avatarImageSpeak: document.getElementById('avatarImageSpeak'),
                microAlert: document.getElementById('microAlert')
            };

            const narratorData = {
                1: {
                    name: 'Nara',
                    sleep: 'webp/nara-espera.webp',
                    hasVoice: true,
                    speakingWebp: 'webp/nara-speak02.webp',
                    audioSequence: [
                        'audio/nara-intro.mp3',
                        'audio/nara-speak01.mp3',
                        'audio/nara-speak02.mp3'
                    ]
                },
                2: {
                    name: 'Mimi',
                    sleep: 'webp/mimi-espera.webp',
                    hasVoice: true,
                    speakingWebp: 'webp/mimi-intro.webp',
                    audioSequence: [
                        'audio/mimi-intro.mp3',
                        'audio/mimi-speak01.mp3',
                        'audio/mimi-speak02.mp3',
                        'audio/mimi-speak03.mp3'
                    ]
                },
                3: {
                    name: 'Vid',
                    sleep: 'webp/vid-espera.webp',
                    hasVoice: false,
                    speakingWebp: '',
                    audioSequence: []
                },
                4: {
                    name: 'Ava',
                    sleep: 'webp/ava-espera.webp',
                    hasVoice: false,
                    speakingWebp: '',
                    audioSequence: []
                }
            };

            const state = {
                isExpanded: false,
                isNarratorPlaying: false,
                isMusicPlaying: false,
                currentNarratorId: 1,
                currentAudioIndex: 0,
                isDragging: false,
                isHiddenByContainer: false,
                avatarAudio: new Audio(),
            };

            function init() {
                state.avatarAudio.preload = 'auto';
                setupEventListeners();
                changeNarrator(state.currentNarratorId, false);
                positionPlayerTopRight();
            }

            function positionPlayerTopRight() {
                elements.audioPlayer.style.right = '20px';
                elements.audioPlayer.style.top = '20px';
                elements.audioPlayer.style.left = 'auto';
                elements.audioPlayer.style.bottom = 'auto';
            }

            function setupEventListeners() {
                elements.playButtonMain.addEventListener('click', toggleNarratorPlayback);
                elements.prevButton.addEventListener('click', () => navigateSequence('prev'));
                elements.nextButton.addEventListener('click', () => navigateSequence('next'));
                elements.playerClosed.addEventListener('mousedown', e => state.isDragging = false);
                elements.playerClosed.addEventListener('mouseup', e => {
                    if (!state.isDragging) toggleNarratorPlayback();
                });
                state.avatarAudio.addEventListener('ended', handleAudioEnded);
                state.avatarAudio.addEventListener('timeupdate', updateProgress);
                elements.narratorOptions.forEach(option => {
                    option.addEventListener('click', function() {
                        const newNarratorId = parseInt(this.getAttribute('data-narrator'), 10);
                        if (newNarratorId !== state.currentNarratorId) {
                            changeNarrator(newNarratorId);
                        }
                        elements.narratorControl.classList.remove('is-open');
                    });
                });
                elements.musicButton.addEventListener('click', toggleBackgroundMusic);
                elements.progressBar.addEventListener('click', seekAudio);
                elements.expandButton.addEventListener('click', toggleExpand);
                elements.narratorsButton.addEventListener('click', toggleNarratorSelector);
                document.addEventListener('click', e => {
                    if (state.isExpanded && !elements.audioPlayer.contains(e.target) && !elements.expandButton.contains(e.target)) {
                        toggleExpand();
                    }
                    if (elements.narratorControl.classList.contains('is-open') && !e.target.closest('.narrator-control')) {
                        elements.narratorControl.classList.remove('is-open');
                    }
                });
            }

            function playCurrentAudio() {
                if (window.ContentContainers) ContentContainers.stopAll();
                const narrator = narratorData[state.currentNarratorId];
                if (!narrator.hasVoice || narrator.audioSequence.length === 0) {
                    showMicroAlert("Este avatar no tiene audio disponible");
                    stopPlayback();
                    return;
                }
                state.currentAudioIndex = Math.max(0, Math.min(state.currentAudioIndex, narrator.audioSequence.length - 1));
                elements.avatarImageSleep.classList.remove('active');
                const audioSrc = narrator.audioSequence[state.currentAudioIndex];
                const webpSrc = narrator.speakingWebp;
                MediaManager.playAudio(state.avatarAudio, elements.avatarImageSpeak, audioSrc, webpSrc);
                state.isNarratorPlaying = true;
                updatePlayButtons();
            }

            function stopPlayback() {
                state.isNarratorPlaying = false;
                state.avatarAudio.pause();
                state.avatarAudio.currentTime = 0;
                elements.avatarImageSpeak.style.display = 'none';
                elements.avatarImageSleep.classList.add('active');
                updatePlayButtons();
                elements.progressFill.style.width = '0%';
                elements.timeDisplay.textContent = '0:00';
            }

            function toggleNarratorPlayback() {
                if (!narratorData[state.currentNarratorId].hasVoice) {
                    showMicroAlert("Este avatar no tiene audio disponible");
                    return;
                }
                if (state.isNarratorPlaying) {
                    state.avatarAudio.pause();
                    state.isNarratorPlaying = false;
                    elements.avatarImageSpeak.style.display = 'none';
                    elements.avatarImageSleep.classList.add('active');
                } else {
                    playCurrentAudio();
                }
                updatePlayButtons();
            }

            function navigateSequence(direction) {
                const narrator = narratorData[state.currentNarratorId];
                if (!narrator || !narrator.hasVoice) return;
                const lastIndex = narrator.audioSequence.length - 1;
                if (direction === 'next') {
                    state.currentAudioIndex = Math.min(state.currentAudioIndex + 1, lastIndex);
                } else if (direction === 'prev') {
                    state.currentAudioIndex = Math.max(state.currentAudioIndex - 1, 0);
                }
                if (state.isNarratorPlaying) playCurrentAudio();
            }

            function changeNarrator(narratorId, startPlaying = false) {
                MediaManager.pauseAllAudio();
                MediaManager.hideAllWebP();
                state.currentNarratorId = narratorId;
                state.currentAudioIndex = 0;
                elements.narratorOptions.forEach(opt => {
                    opt.classList.toggle('active', parseInt(opt.dataset.narrator) === narratorId);
                });
                const narrator = narratorData[narratorId];
                if (narrator) {
                    elements.avatarImageSleep.src = narrator.sleep;
                    stopPlayback();
                }
                if (startPlaying) playCurrentAudio();
            }

            function handleAudioEnded() {
                stopPlayback();
            }

            function updateProgress() {
                const { currentTime, duration } = state.avatarAudio;
                if (duration > 0) {
                    elements.progressFill.style.width = `${(currentTime / duration) * 100}%`;
                    const mins = Math.floor(currentTime / 60);
                    const secs = Math.floor(currentTime % 60).toString().padStart(2, '0');
                    elements.timeDisplay.textContent = `${mins}:${secs}`;
                }
            }

            function seekAudio(e) {
                const rect = this.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                if (state.avatarAudio.duration) {
                    state.avatarAudio.currentTime = percent * state.avatarAudio.duration;
                }
            }

            function toggleBackgroundMusic() {
                state.isMusicPlaying = !state.isMusicPlaying;
                if (state.isMusicPlaying) {
                    elements.backgroundMusic.play().catch(e => console.error("Error al reproducir música:", e));
                } else {
                    elements.backgroundMusic.pause();
                }
                elements.musicButton.classList.toggle('active', state.isMusicPlaying);
                elements.musicButton.classList.toggle('muted', !state.isMusicPlaying);
            }

            function toggleNarratorSelector() {
                const rect = elements.audioPlayer.getBoundingClientRect();
                const openUpward = rect.bottom > window.innerHeight * 0.6;
                elements.narratorControl.classList.toggle('open-upward', openUpward);
                elements.narratorControl.classList.toggle('is-open');
            }

            function toggleExpand(e) {
                if (e) e.stopPropagation();
                state.isExpanded = !state.isExpanded;
                elements.audioPlayer.classList.toggle('expanded', state.isExpanded);
                elements.playerClosed.style.display = state.isExpanded ? 'none' : '';
                elements.audioPlayer.classList.toggle('player-centered', state.isExpanded);
            }

            function updatePlayButtons() {
                elements.playButtonMain.classList.toggle('playing', state.isNarratorPlaying);
            }

            function showMicroAlert(message = "Toca de nuevo para escuchar") {
                elements.microAlert.textContent = message;
                elements.microAlert.classList.add('show');
                setTimeout(() => elements.microAlert.classList.remove('show'), 3000);
            }

            init();

            return {
                getCurrentNarrator: () => narratorData[state.currentNarratorId],
                stop: stopPlayback,
                hideAvatar: () => {
                    elements.audioPlayer.style.opacity = '0';
                    elements.audioPlayer.style.pointerEvents = 'none';
                    state.isHiddenByContainer = true;
                },
                showAvatar: () => {
                    elements.audioPlayer.style.opacity = '1';
                    elements.audioPlayer.style.pointerEvents = 'auto';
                    state.isHiddenByContainer = false;
                },
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
                    const audioIndex = parseInt(playBtn.dataset.audioIndex, 10);
                    container.audioElement = new Audio();
                    container.audioElement.preload = 'auto';
                    
                    playBtn.addEventListener('click', e => {
                        e.stopPropagation();
                        const narrator = AudioPlayer.getCurrentNarrator();
                        
                        if (!narrator.hasVoice) {
                            AudioPlayer.showMicroAlert("Este avatar no tiene audio disponible");
                            return;
                        }
                        
                        if (activeContainer === container) {
                            stopContainer(container);
                            return;
                        }
                        
                        if (activeContainer) stopContainer(activeContainer);
                        AudioPlayer.stop();
                        AudioPlayer.hideAvatar();
                        playContainer(container, audioIndex);
                    });
                    
                    // CAMBIO: Al hacer clic en el avatar del contenedor, se detiene y reinicia.
                    container.querySelector('.webp-overlay-container').addEventListener('click', () => {
                        if (activeContainer === container) {
                            stopContainer(container);
                        }
                    });
                    
                    container.audioElement.addEventListener('ended', () => stopContainer(container));
                });
            }

            function playContainer(container, audioIndex) {
                const narrator = AudioPlayer.getCurrentNarrator();
                const webpOverlay = container.querySelector('.overlay-webp');
                
                if (!narrator.audioSequence || audioIndex > narrator.audioSequence.length) {
                    console.error("Índice de audio no disponible:", audioIndex);
                    AudioPlayer.showAvatar();
                    return;
                }
                
                const actualIndex = audioIndex - 1;
                const audioSrc = narrator.audioSequence[actualIndex];
                const webpSrc = narrator.speakingWebp;
                
                MediaManager.playAudio(container.audioElement, webpOverlay, audioSrc, webpSrc);
                
                container.classList.add('playing');
                container.querySelector('.container-play-btn i').className = 'fas fa-pause';
                activeContainer = container;
            }

            function stopContainer(container) {
                if (!container) return;
                const audioElement = container.audioElement;
                if (!audioElement.paused) audioElement.pause();
                audioElement.currentTime = 0;
                
                container.querySelector('.webp-overlay-container').classList.remove('visible');
                container.querySelector('.overlay-webp').src = '';
                container.classList.remove('playing');
                container.querySelector('.container-play-btn i').className = 'fas fa-play';
                
                if (activeContainer === container) {
                    AudioPlayer.showAvatar();
                    activeContainer = null;
                }
            }

            init();

            return {
                stopAll: () => stopContainer(activeContainer)
            };
        })();

        // Módulo para arrastrar el reproductor
        (function() {
            const player = document.querySelector('.audio-player');
            let isDragging = false, startX, startY, initialLeft, initialTop;
            const startDrag = (e) => {
                if (!e.target.closest('.player-closed') || AudioPlayer.state.isExpanded) return;
                isDragging = true;
                AudioPlayer.state.isDragging = true;
                player.classList.add('dragging');
                const rect = player.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;
                startX = e.clientX || e.touches[0].clientX;
                startY = e.clientY || e.touches[0].clientY;
                e.preventDefault();
            };
            const duringDrag = (e) => {
                if (!isDragging) return;
                const currentX = e.clientX || e.touches[0].clientX;
                const currentY = e.clientY || e.touches[0].clientY;
                let newX = initialLeft + (currentX - startX);
                let newY = initialTop + (currentY - startY);
                const margin = 10;
                newX = Math.max(margin, Math.min(newX, window.innerWidth - player.offsetWidth - margin));
                newY = Math.max(margin, Math.min(newY, window.innerHeight - player.offsetHeight - margin));
                player.style.left = `${newX}px`;
                player.style.top = `${newY}px`;
                player.style.right = 'auto';
            };
            const stopDrag = () => {
                if (!isDragging) return;
                isDragging = false;
                AudioPlayer.state.isDragging = false;
                player.classList.remove('dragging');
            };
            document.addEventListener('mousedown', startDrag);
            document.addEventListener('mousemove', duringDrag);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchstart', startDrag, { passive: false });
            document.addEventListener('touchmove', duringDrag, { passive: false });
            document.addEventListener('touchend', stopDrag);
        })();
