Vue.createApp({
    data() {
        return {
            stickies: [],           // Your app's variables go here
            draggedIndex: null,
            currentStickiesId: null,      // Current sticky set ID from URL
            saveTimeout: null,            // For debouncing saves
            isLoading: false,             // Prevents concurrent API calls
            saveStatus: 'saved',          // 'saving', 'saved', 'error'
            lastSaved: null,              // Timestamp of last successful save
            hasUnsavedChanges: false      // Tracks pending changes    
            
        }
    },
    async mounted() {
        // Extract ID from URL path
        const path = window.location.pathname;
        const urlId = path.substring(1); // Remove leading slash

        // Check if it looks like a valid stickies ID (8 alphanumeric chars)
        if (/^[0-9a-fA-F]{24}$/.test(urlId)) {
            console.log('Found stickies ID in URL:', urlId);
            this.currentStickiesId = urlId;
            await this.loadFromServer();
        } else {
            console.log('No valid stickies ID in URL, starting with empty stickies');
            // Start with a single empty sticky note
            this.stickies = [{ text: '', color: '#fcfa5d', id: Date.now() }];
        }

        // Set up beforeunload handler to warn about unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges && this.saveStatus === 'saving') {
                e.preventDefault();
                return 'You have unsaved changes. Are you sure you want to leave?';
            }
        }); 
    },
    methods: {
        // All our functions go here
        onArrowLeft(event, index) {
            const input = event.target;
            if (input.selectionStart === 0 && index > 0) {
            this.$nextTick(() => {
            const prevInput = this.$refs.stickieInputs[index - 1];
            if (prevInput) {
                prevInput.focus();
                const len = prevInput.value.length;
                prevInput.selectionStart = prevInput.selectionEnd = len;
            }
        });
        }
    },

        onArrowRight(event, index) {
            const input = event.target;
            if (input.selectionStart === input.value.length && index < this.stickies.length - 1) {
            this.$nextTick(() => {
            const nextInput = this.$refs.stickieInputs[index + 1];
            if (nextInput) {
                nextInput.focus();
                nextInput.selectionStart = nextInput.selectionEnd = 0; // Start of next
            }
            });
        }
    },
        
        onTabKey(event, index) {
        event.preventDefault(); // Prevent default tab behavior

        const lastIndex = this.stickies.length - 1;

        if (index === lastIndex) {
            // Tab pressed on last textarea: add new note and focus it
            this.addStickie();

            this.$nextTick(() => {
                // Focus new last textarea, cursor at start (or end)
                const inputs = this.$refs.stickieInputs;
                if (inputs && inputs.length > 0) {
                    const newInput = inputs[inputs.length - 1];
                    newInput.focus();
                    // Place cursor at start or end
                    newInput.selectionStart = newInput.selectionEnd = 0;
                }
            });
        } else {
            // Tab pressed on any other textarea: focus next textarea at end of text
            this.$nextTick(() => {
                const inputs = this.$refs.stickieInputs;
                if (inputs && inputs[index + 1]) {
                    const nextInput = inputs[index + 1];
                    nextInput.focus();
                    // Place cursor at end of text
                    const len = nextInput.value.length;
                    nextInput.selectionStart = nextInput.selectionEnd = len;
                }
            });
        }
    },

        onDeleteKey(index) {
            if (this.stickies[index].text.trim() === '') {
                this.deleteStickie(index);

                this.$nextTick(() => {
                // Focus last textarea if any remain
                const inputs = this.$refs.stickieInputs;
                if (inputs && inputs.length > 0) {
                    const lastInput = inputs[inputs.length - 1];
                    lastInput.focus();
                    const len = lastInput.value.length;
                    lastInput.selectionStart = lastInput.selectionEnd = len;
                }
                });
            }
        },
        addStickie() {
            const colors = ['#fcfa5d', '#6eed2a', '#f989d6', '#20dff8', '#ff9999', '#99ff99', '#9999ff', '#ffcc99'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            
            this.stickies.push({
                text: '',              // Empty text to start
                color: randomColor,      // Default yellow color
                id: Date.now(),        // Unique ID using timestamp
                createdAt: new Date().toLocaleString()
            });
        },
        deleteStickie(index) {
            if (this.stickies[index].text.trim() === '') {
                this.stickies.splice(index, 1);
            }
        },
        changeColor(index) {
            const colors = ['#fcfa5d', '#6eed2a', '#f989d6', '#20dff8',
                '#ff9999', '#99ff99', '#9999ff', '#ffcc99'];
            const currentColor = this.stickies[index].color;
            const currentIndex = colors.indexOf(currentColor);
            const newColorIndex = (currentIndex + 1) % colors.length;
            this.stickies[index].color = colors[newColorIndex];
        },
        saveToStorage() {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(this.stickies));
                console.log('Data saved to localStorage');
            } catch (error) {
                console.error('Failed to save to localStorage:', error);
            }
        },
        loadFromStorage() {
            try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            this.stickies = JSON.parse(stored);
            console.log('Data loaded from localStorage');
        } else {
            // First time use: create one default note
            this.addStickie();
        }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            this.stickies = [];
            this.addStickie(); // Add one default note on error
         }
        },
        clearStorage() {
            localStorage.removeItem(this.storageKey);
            this.stickies = [];
            console.log('Storage cleared');
        },
        onDragStart(event, index) {
            this.draggedIndex = index;                    // Remember which note we're dragging
            event.dataTransfer.effectAllowed = 'move';    // Set the drag effect type
            event.target.classList.add('dragging');      // Add CSS class for visual feedback
        },
        onDragEnd(event) {
            event.target.classList.remove('dragging');   // Remove visual feedback
            this.draggedIndex = null;                     // Clear the dragged index
        },
        onDragOver(event) {
            event.preventDefault();                       // MUST do this to allow dropping
            event.dataTransfer.dropEffect = 'move';     // Show move cursor
        },
        onDragEnter(event) {
            event.preventDefault();                       // Also required for drag and drop
        },
        onDrop(event, targetIndex) {
            event.preventDefault();

            if (this.draggedIndex !== null && this.draggedIndex !== targetIndex) {
                // Remove the dragged item from its current position
                const draggedItem = this.stickies.splice(this.draggedIndex, 1)[0];

                // Insert it at the new position
                this.stickies.splice(targetIndex, 0, draggedItem);
            }
        },
               async loadFromServer() {
            if (!this.currentStickiesId) {
                console.log('No stickies ID available');
                return;
            }

            this.isLoading = true;
            try {
                const response = await fetch(`/api/${this.currentStickiesId}`);

                if (response.ok) {
                    const data = await response.json();
                    this.stickies = data.stickies;
                    this.saveStatus = 'saved';
                    this.hasUnsavedChanges = false;
                    console.log('Data loaded from server');
                } else if (response.status === 404) {
                    console.log('Stickies not found on server');
                    // Start with empty stickies for 404
                    this.stickies = [{ text: '', color: '#fcfa5d', id: Date.now() }];
                    this.saveStatus = 'saved';
                } else {
                    throw new Error(`Server error: ${response.status}`);
                }
            } catch (error) {
                console.error('Failed to load from server:', error);
                this.saveStatus = 'error';
                // Start with empty stickies on error
                this.stickies = [{ text: '', color: '#fcfa5d', id: Date.now() }];
            } finally {
                this.isLoading = false;
            }
        },

        async saveToServer() {
            if (this.isLoading || !this.currentStickiesId) return;

            this.isLoading = true;
            try {
                // Use DELETE route if stickies array is empty
                if (this.stickies.length === 0) {
                    const response = await fetch(`/api/${this.currentStickiesId}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        console.log('Sticky set deleted on server, refreshing to new state');
                        this.refreshToNewStickySet();
                        return;
                    } else {
                        throw new Error(`Delete failed: ${response.status}`);
                    }
                } else {
                    // Use PUT route for updating existing stickies
                    const response = await fetch(`/api/${this.currentStickiesId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(this.stickies)
                    });

                    if (response.ok) {
                        this.saveStatus = 'saved';
                        this.lastSaved = new Date();
                        this.hasUnsavedChanges = false;
                        console.log('Data saved to server');
                    } else {
                        throw new Error(`Save failed: ${response.status}`);
                    }
                }
            } catch (error) {
                console.error('Failed to save to server:', error);
                this.saveStatus = 'error';
            } finally {
                this.isLoading = false;
            }
        },

        debouncedSave() {
            this.saveStatus = 'saving';
            this.hasUnsavedChanges = true;

            // Clear existing timeout
            clearTimeout(this.saveTimeout);

            // Set new timeout
            this.saveTimeout = setTimeout(() => {
                if (this.currentStickiesId) {
                    this.saveToServer();
                } else {
                    this.createNewStickiesOnServer();
                }
            }, 1000); // Save 1 second after user stops making changes
        },

        async createNewStickiesOnServer() {
            if (this.isLoading) return;

            // Don't create if stickies is empty or only has empty notes
            const hasContent = this.stickies.some(sticky => sticky.text && sticky.text.trim() !== '');
            if (!hasContent) {
                this.saveStatus = 'saved';
                return;
            }

            this.isLoading = true;
            try {
                const response = await fetch('/api/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.stickies)
                });

                if (response.ok) {
                    const data = await response.json();
                    this.currentStickiesId = data.id;
                    this.saveStatus = 'saved';
                    this.lastSaved = new Date();
                    this.hasUnsavedChanges = false;

                    // Update URL without page reload
                    window.history.pushState({}, '', `/${data.id}`);

                    console.log('New stickies created on server with ID:', data.id);
                } else {
                    throw new Error(`Create failed: ${response.status}`);
                }
            } catch (error) {
                console.error('Failed to create stickies on server:', error);
                this.saveStatus = 'error';
            } finally {
                this.isLoading = false;
            }
        },

        refreshToNewStickySet() {
            // Reset to fresh state with new sticky
            this.stickies = [{ text: '', color: '#fcfa5d', id: Date.now() }];
            this.currentStickiesId = null;
            this.saveStatus = 'saved';
            this.hasUnsavedChanges = false;
            this.lastSaved = null;

            // Update URL to remove ID
            window.history.pushState({}, '', '/');

            // Focus the new sticky
            this.$nextTick(() => {
                const textareas = this.$refs.textarea;
                if (textareas && textareas.length > 0) {
                    textareas[0].focus();
                }
            });

            console.log('Refreshed to new sticky set');
        }


    },
    watch: {
        stickies: {
            handler() {
                this.debouncedSave();  // Automatically save when notes change
            },
            deep: true                 // Watch for changes inside the objects in our array
        }
    }
}).mount('#app');
