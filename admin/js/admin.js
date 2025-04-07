document.addEventListener('DOMContentLoaded', () => {
    // Current path in the file browser
    let currentPath = '';
    // Currently selected file for deletion
    let selectedFileForDeletion = null;
    // Current album metadata for inheritance
    let currentAlbumMetadata = null;

    // DOM Elements
    const fileList = document.getElementById('file-list');
    const pathBreadcrumb = document.getElementById('path-breadcrumb');
    const refreshBtn = document.getElementById('refresh-btn');
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadList = document.getElementById('upload-list');
    const albumNameInput = document.getElementById('album-name');
    const createAlbumBtn = document.getElementById('create-album-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteFilename = document.getElementById('delete-filename');
    // downloadAllAlbumsBtn will be initialized in DOMContentLoaded
    
    // Album metadata elements
    const albumArtistInput = document.getElementById('album-artist');
    const albumYearInput = document.getElementById('album-year');
    const albumGenreInput = document.getElementById('album-genre');
    const albumCopyrightInput = document.getElementById('album-copyright');
    const albumCustomMetadataFields = document.getElementById('album-custom-metadata-fields');
    const addAlbumMetadataFieldBtn = document.getElementById('add-album-metadata-field');
    
    // Metadata elements
    const metadataFilename = document.getElementById('metadata-filename');
    const metadataFilepath = document.getElementById('metadata-filepath');
    const metadataForm = document.getElementById('metadata-form');
    const metadataArtist = document.getElementById('metadata-artist');
    const metadataAlbum = document.getElementById('metadata-album');
    const metadataYear = document.getElementById('metadata-year');
    const metadataGenre = document.getElementById('metadata-genre');
    const metadataCopyright = document.getElementById('metadata-copyright');
    const customMetadataFields = document.getElementById('custom-metadata-fields');
    const addMetadataFieldBtn = document.getElementById('add-metadata-field');
    const saveMetadataBtn = document.getElementById('save-metadata-btn');
    const metadataStatus = document.getElementById('metadata-status');

    // Bootstrap modals
    const uploadModalElement = document.getElementById('upload-modal');
    const uploadModal = new bootstrap.Modal(uploadModalElement);
    const createAlbumModal = new bootstrap.Modal(document.getElementById('create-album-modal'));
    const previewModal = new bootstrap.Modal(document.getElementById('preview-modal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('delete-modal'));
    const metadataModal = new bootstrap.Modal(document.getElementById('metadata-modal'));
    const createFolderModal = new bootstrap.Modal(document.getElementById('create-folder-modal'));
    
    // Add event listener to reset upload modal when it's hidden
    uploadModalElement.addEventListener('hidden.bs.modal', () => {
        // Reset file input and upload list
        if (fileInput) fileInput.value = '';
        if (uploadList) uploadList.innerHTML = '';
        
        // Reset progress bar
        const progressBar = document.querySelector('.progress-bar');
        const progress = document.querySelector('.progress');
        if (progress) progress.style.display = 'none';
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.textContent = '';
        }
        
        // Reset upload button
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = 'Upload';
        }
    });
    
    // Add event listener to update folder path when create folder modal is opened
    const createFolderModalElement = document.getElementById('create-folder-modal');
    if (createFolderModalElement) {
        createFolderModalElement.addEventListener('show.bs.modal', () => {
            const folderPathInput = document.getElementById('folder-path');
            if (folderPathInput) {
                folderPathInput.value = currentPath;
            }
        });
    }
    
    // Add event listener to reset metadata modal when it's hidden
    const metadataModalElement = document.getElementById('metadata-modal');
    if (metadataModalElement) {
        metadataModalElement.addEventListener('hidden.bs.modal', () => {
            console.log('Metadata modal closed, resetting state');
            // This ensures the modal can be reopened properly
            setTimeout(() => {
                if (customMetadataFields) customMetadataFields.innerHTML = '';
                if (metadataStatus) metadataStatus.style.display = 'none';
            }, 100);
        });
    }

    // Initialize the file browser
    loadFiles(currentPath);

    // Event listeners
    refreshBtn.addEventListener('click', () => loadFiles(currentPath));
    
    // File upload events
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelection);
    uploadBtn.addEventListener('click', uploadFiles);
    
    // Album metadata events
    if (addAlbumMetadataFieldBtn) {
        addAlbumMetadataFieldBtn.addEventListener('click', () => addCustomMetadataField(albumCustomMetadataFields));
    }
    
    // Drag and drop events
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('highlight');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('highlight');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('highlight');
        
        const files = e.dataTransfer.files;
        handleFiles(files);
    });
    
    // Create album event
    createAlbumBtn.addEventListener('click', createAlbum);
    
    // Create folder event
    const createFolderBtn = document.getElementById('create-folder-submit-btn');
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', createFolder);
    }
    
    // Delete confirmation event
    confirmDeleteBtn.addEventListener('click', deleteFile);
    
    // Metadata events
    addMetadataFieldBtn.addEventListener('click', () => addCustomMetadataField(customMetadataFields));
    saveMetadataBtn.addEventListener('click', saveMetadata);

    /**
     * Load files from the server
     */
    function loadFiles(path) {
        currentPath = path;
        updateBreadcrumb(path);
        
        // Check if we're in an album folder and try to load album metadata
        if (path.startsWith('albums/') && path.split('/').length === 2) {
            // We're in an album root folder, try to get album metadata
            const albumName = path.split('/')[1];
            // Load album metadata if the function exists
            if (typeof loadAlbumMetadata === 'function') {
                loadAlbumMetadata(albumName);
            }
        } else {
            // Reset album metadata when not in an album folder
            currentAlbumMetadata = null;
        }
        
        // Show loading indicator
        fileList.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading files...</p>
            </div>
        `;
        
        // Log for debugging
        console.log(`Loading files from path: ${path}`);
        
        // Fetch files from the server
        fetch(`/api/admin/objects?prefix=${encodeURIComponent(path)}&delimiter=/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Files loaded:', data);
                
                const commonPrefixes = data.commonPrefixes || [];
                const contents = data.contents || [];
                
                if (commonPrefixes.length === 0 && contents.length === 0) {
                    fileList.innerHTML = `
                        <div class="text-center py-5">
                            <i class="bi bi-folder2-open display-4 text-muted"></i>
                            <p class="mt-2">This folder is empty</p>
                        </div>
                    `;
                    return;
                }
                
                let html = '';
                
                // Add parent directory if not at root
                if (path !== '') {
                    const parentPath = path.split('/').slice(0, -2).join('/');
                    html += `
                        <div class="file-item" data-type="folder" data-path="${parentPath}">
                            <i class="bi bi-arrow-up-circle file-icon folder-icon"></i>
                            <div class="file-info">
                                <div class="file-name">..</div>
                                <div class="file-meta text-muted small">Parent Directory</div>
                            </div>
                        </div>
                    `;
                }
                
                // Add folders
                commonPrefixes.forEach(prefix => {
                    const folderName = prefix.Prefix.replace(path, '').replace('/', '');
                    const isAlbumFolder = prefix.Prefix.startsWith('albums/') && prefix.Prefix.split('/').length === 3;
                    
                    html += `
                        <div class="file-item" data-type="folder" data-path="${prefix.Prefix}">
                            <i class="bi bi-folder-fill file-icon folder-icon"></i>
                            <div class="file-info">
                                <div class="file-name">${folderName}</div>
                                <div class="file-meta text-muted small">Folder</div>
                            </div>
                            ${isAlbumFolder ? `
                            <div class="file-actions">
                                <button class="btn btn-sm btn-outline-primary download-album-btn" data-album="${folderName}" title="Download album as ZIP">
                                    <i class="bi bi-download"></i>
                                </button>
                            </div>` : ''}
                        </div>
                    `;
                });
                
                // Add files
                contents.forEach(file => {
                    // Skip the current directory marker
                    if (file.Key === path) return;
                    
                    const fileName = file.Key.replace(path, '');
                    const fileSize = formatFileSize(file.Size);
                    const lastModified = new Date(file.LastModified).toLocaleString();
                    
                    // Determine file type and icon
                    let fileIcon = 'bi-file';
                    let fileType = 'File';
                    
                    if (fileName.endsWith('.mp3') || fileName.endsWith('.wav')) {
                        fileIcon = 'bi-file-music-fill music-icon';
                        fileType = 'Audio';
                    } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) {
                        fileIcon = 'bi-file-image-fill image-icon';
                        fileType = 'Image';
                    }
                    
                    html += `
                        <div class="file-item" data-type="file" data-key="${file.Key}">
                            <i class="bi ${fileIcon} file-icon"></i>
                            <div class="file-info">
                                <div class="file-name">${fileName}</div>
                                <div class="file-meta text-muted small">${fileType} · ${fileSize} · ${lastModified}</div>
                            </div>
                            <div class="file-actions">
                                <button class="btn btn-sm btn-outline-primary preview-btn" data-key="${file.Key}">
                                    <i class="bi bi-eye"></i>
                                </button>
                                ${fileName.endsWith('.mp3') ? `
                                <button class="btn btn-sm btn-outline-info metadata-btn" data-key="${file.Key}" data-name="${fileName}">
                                    <i class="bi bi-tag"></i>
                                </button>` : ''}
                                <button class="btn btn-sm btn-outline-danger delete-btn" data-key="${file.Key}" data-name="${fileName}">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                fileList.innerHTML = html;
                
                // Add event listeners to the file items
                document.querySelectorAll('.file-item[data-type="folder"]').forEach(item => {
                    item.addEventListener('click', () => {
                        const path = item.dataset.path;
                        loadFiles(path);
                        
                        // If this is an album folder, try to load album metadata
                        if (path.startsWith('albums/') && path.split('/').length === 3) {
                            const albumName = path.split('/')[1];
                            loadAlbumMetadata(albumName);
                        }
                    });
                });
                
                document.querySelectorAll('.preview-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        previewFile(btn.dataset.key);
                    });
                });
                
                document.querySelectorAll('.delete-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showDeleteConfirmation(btn.dataset.key, btn.dataset.name);
                    });
                });
                
                document.querySelectorAll('.metadata-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showMetadataEditor(btn.dataset.key, btn.dataset.name);
                    });
                });
                
                // Add event listeners to download album buttons
                document.querySelectorAll('.download-album-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        downloadAlbum(btn.dataset.album);
                    });
                });
            })
            .catch(error => {
                console.error('Error loading files:', error);
                fileList.innerHTML = `
                    <div class="alert alert-danger">
                        Error loading files: ${error.message}
                    </div>
                `;
            });
    }

    /**
     * Update the breadcrumb navigation
     */
    function updateBreadcrumb(path) {
        const parts = path.split('/').filter(Boolean);
        let html = '<li class="breadcrumb-item"><a href="#" data-path="">Root</a></li>';
        let currentPath = '';
        
        parts.forEach((part, index) => {
            currentPath += part + '/';
            const isLast = index === parts.length - 1;
            
            if (isLast) {
                html += `<li class="breadcrumb-item active">${part}</li>`;
            } else {
                html += `<li class="breadcrumb-item"><a href="#" data-path="${currentPath}">${part}</a></li>`;
            }
        });
        
        pathBreadcrumb.innerHTML = html;
        
        // Add event listeners to breadcrumb links
        document.querySelectorAll('#path-breadcrumb a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                loadFiles(link.dataset.path);
            });
        });
    }

    /**
     * Handle file selection for upload
     */
    function handleFileSelection(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    /**
     * Process files for upload
     */
    function handleFiles(files) {
        uploadList.innerHTML = '';
        
        Array.from(files).forEach(file => {
            // Check if file type is supported
            const isSupported = [
                'audio/mpeg', 'audio/mp3', 'audio/wav',
                'image/jpeg', 'image/jpg', 'image/png'
            ].includes(file.type);
            
            const fileItem = document.createElement('div');
            fileItem.className = 'mb-2 d-flex align-items-center';
            fileItem.innerHTML = `
                <i class="bi ${getFileIcon(file.type)} me-2"></i>
                <div class="flex-grow-1">
                    <div>${file.name}</div>
                    <div class="small text-muted">${formatFileSize(file.size)}</div>
                </div>
                ${isSupported ? '' : '<span class="badge bg-danger">Unsupported</span>'}
            `;
            
            uploadList.appendChild(fileItem);
        });
        
        // Enable/disable upload button based on file selection
        uploadBtn.disabled = Array.from(files).length === 0;
    }

    /**
     * Upload files to the server
     */
    function uploadFiles() {
        const files = fileInput.files;
        if (files.length === 0) return;
        
        const progressBar = document.querySelector('.progress-bar');
        const progress = document.querySelector('.progress');
        
        // Disable the upload button and close button to prevent closing during upload
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';
        
        // Disable the modal close button and prevent dismissal
        const closeBtn = uploadModalElement.querySelector('.btn-close');
        if (closeBtn) closeBtn.disabled = true;
        uploadModalElement.setAttribute('data-bs-backdrop', 'static');
        uploadModalElement.setAttribute('data-bs-keyboard', 'false');
        
        // Reset progress display
        progress.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        
        // Create a single FormData object for all files
        const formData = new FormData();
        
        // Append all files to the FormData
        Array.from(files).forEach(file => {
            formData.append('files', file);
        });
        
        // Add path and metadata info
        formData.append('path', currentPath);
        
        // Check if we're in an album folder and have album metadata to apply
        if (currentPath.startsWith('albums/') && currentAlbumMetadata) {
            const albumName = currentPath.split('/')[1];
            formData.append('albumName', albumName);
            formData.append('applyAlbumMetadata', 'true');
            console.log('Applying album metadata to upload:', currentAlbumMetadata);
        }
        
        // Use XMLHttpRequest to track upload progress
        const xhr = new XMLHttpRequest();
        
        // Set a timeout for the request (30 seconds)
        xhr.timeout = 30000;
        
        // Setup progress event
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                progressBar.style.width = `${percentComplete}%`;
                progressBar.textContent = `${percentComplete}%`;
            }
        });
        
        // Setup completion handler
        xhr.addEventListener('load', () => {
            // Re-enable the upload button
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = 'Upload';
            
            // Re-enable the close button and restore modal behavior
            const closeBtn = uploadModalElement.querySelector('.btn-close');
            if (closeBtn) closeBtn.disabled = false;
            uploadModalElement.removeAttribute('data-bs-backdrop');
            uploadModalElement.removeAttribute('data-bs-keyboard');
            
            if (xhr.status >= 200 && xhr.status < 300) {
                const response = JSON.parse(xhr.responseText);
                console.log('Files uploaded successfully', response);
                
                // Show success notification
                const notification = document.createElement('div');
                notification.className = 'alert alert-success alert-dismissible fade show';
                notification.innerHTML = `
                    <strong>Success!</strong>
                    <p>${response.message}</p>
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                `;
                
                const fileListContainer = document.querySelector('#file-list-container');
                if (fileListContainer) {
                    fileListContainer.insertBefore(notification, fileListContainer.firstChild);
                    
                    // Auto-dismiss after 5 seconds
                    setTimeout(() => {
                        notification.classList.remove('show');
                        setTimeout(() => notification.remove(), 500);
                    }, 5000);
                }
                
                // Reset the progress display before closing modal
                progress.style.display = 'none';
                progressBar.style.width = '0%';
                progressBar.textContent = '';
                
                // Close the modal and refresh the file list
                uploadModal.hide();
                loadFiles(currentPath);
                
                // Reset the file input
                fileInput.value = '';
                uploadList.innerHTML = '';
            } else {
                console.error('Error uploading files:', xhr.statusText);
                alert(`Error uploading files: ${xhr.statusText}`);
                progress.style.display = 'none';
            }
        });
        
        // Setup error handler
        xhr.addEventListener('error', () => {
            // Re-enable the upload button
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = 'Upload';
            
            // Re-enable the close button and restore modal behavior
            const closeBtn = uploadModalElement.querySelector('.btn-close');
            if (closeBtn) closeBtn.disabled = false;
            uploadModalElement.removeAttribute('data-bs-backdrop');
            uploadModalElement.removeAttribute('data-bs-keyboard');
            
            console.error('Error uploading files: Network error');
            alert('Error uploading files: Network error');
            
            // Reset progress display
            progress.style.display = 'none';
            progressBar.style.width = '0%';
            progressBar.textContent = '';
        });
        
        // Setup timeout handler
        xhr.addEventListener('timeout', () => {
            // Re-enable the upload button
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = 'Upload';
            
            // Re-enable the close button and restore modal behavior
            const closeBtn = uploadModalElement.querySelector('.btn-close');
            if (closeBtn) closeBtn.disabled = false;
            uploadModalElement.removeAttribute('data-bs-backdrop');
            uploadModalElement.removeAttribute('data-bs-keyboard');
            
            console.error('Upload timed out');
            alert('Upload timed out. Please try again.');
            
            // Reset progress display
            progress.style.display = 'none';
            progressBar.style.width = '0%';
            progressBar.textContent = '';
        });
        
        // Open and send the request
        xhr.open('POST', '/api/admin/upload');
        xhr.send(formData);
    }

    /**
     * Create a new album
     */
    function createAlbum() {
        const name = albumNameInput.value.trim();
        
        if (!name) {
            alert('Please enter an album name');
            return;
        }
        
        // Collect metadata from the form
        const metadata = {};
        
        // Add standard metadata fields if they have values
        if (albumArtistInput && albumArtistInput.value.trim()) {
            metadata.artist = albumArtistInput.value.trim();
        }
        
        if (albumYearInput && albumYearInput.value.trim()) {
            metadata.year = albumYearInput.value.trim();
        }
        
        if (albumGenreInput && albumGenreInput.value.trim()) {
            metadata.genre = albumGenreInput.value.trim();
        }
        
        if (albumCopyrightInput && albumCopyrightInput.value.trim()) {
            metadata.copyright = albumCopyrightInput.value.trim();
        }
        
        // Add custom metadata fields
        if (albumCustomMetadataFields) {
            const customRows = albumCustomMetadataFields.querySelectorAll('.custom-metadata-row');
            customRows.forEach(row => {
                const keyInput = row.querySelector('.custom-key');
                const valueInput = row.querySelector('.custom-value');
                
                if (keyInput && valueInput && keyInput.value.trim() && valueInput.value.trim()) {
                    metadata[keyInput.value.trim()] = valueInput.value.trim();
                }
            });
        }
        
        // Create the album with metadata
        fetch('/api/admin/create-album', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, metadata })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Album created with metadata:', data);
            createAlbumModal.hide();
            loadFiles(currentPath);
            
            // Reset the inputs
            albumNameInput.value = '';
            if (albumArtistInput) albumArtistInput.value = '';
            if (albumYearInput) albumYearInput.value = '';
            if (albumGenreInput) albumGenreInput.value = '';
            if (albumCopyrightInput) albumCopyrightInput.value = '';
            
            // Clear custom metadata fields
            if (albumCustomMetadataFields) {
                albumCustomMetadataFields.innerHTML = '';
            }
        })
        .catch(error => {
            console.error('Error creating album:', error);
            alert(`Error creating album: ${error.message}`);
        });
    }
    
    /**
     * Create a new folder
     */
    function createFolder() {
        const folderNameInput = document.getElementById('folder-name');
        const folderPathInput = document.getElementById('folder-path');
        const createFolderBtn = document.getElementById('create-folder-submit-btn');
        
        const name = folderNameInput.value.trim();
        const path = folderPathInput.value.trim();
        
        if (!name) {
            alert('Please enter a folder name');
            return;
        }
        
        // Disable the button to prevent multiple submissions
        createFolderBtn.disabled = true;
        createFolderBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Creating...';
        
        // Create the folder
        fetch('/api/admin/create-folder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, path })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Folder created:', data);
            
            // Close the modal
            createFolderModal.hide();
            
            // Show success notification
            const notification = document.createElement('div');
            notification.className = 'alert alert-success alert-dismissible fade show';
            notification.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="bi bi-check-circle-fill text-success me-2"></i>
                    <div>
                        <strong>Folder Created!</strong>
                        <p class="mb-0">The folder "${name}" has been created successfully.</p>
                    </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            document.querySelector('.container').prepend(notification);
            
            // Auto-dismiss the notification after 5 seconds
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 5000);
            
            // Refresh the file list
            loadFiles(currentPath);
            
            // Reset the inputs
            folderNameInput.value = '';
        })
        .catch(error => {
            console.error('Error creating folder:', error);
            
            // Show error notification
            const notification = document.createElement('div');
            notification.className = 'alert alert-danger alert-dismissible fade show';
            notification.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                    <div>
                        <strong>Error!</strong>
                        <p class="mb-0">Failed to create folder: ${error.message}</p>
                    </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            document.querySelector('.container').prepend(notification);
        })
        .finally(() => {
            // Re-enable the button
            createFolderBtn.disabled = false;
            createFolderBtn.innerHTML = 'Create Folder';
        });
    }

    /**
     * Preview a file
     */
    function previewFile(key) {
        const fileName = key.split('/').pop();
        const previewTitle = document.getElementById('preview-title');
        const previewContent = document.getElementById('preview-content');
        const downloadBtn = document.getElementById('download-btn');
        
        previewTitle.textContent = fileName;
        previewContent.innerHTML = '<div class="text-center py-3">Loading preview...</div>';
        
        // Get a signed URL for the file
        fetch(`/api/admin/objects/${encodeURIComponent(key)}/signed-url`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const url = data.url;
                downloadBtn.href = url;
                
                // Determine file type and create appropriate preview
                if (fileName.endsWith('.mp3') || fileName.endsWith('.wav')) {
                    previewContent.innerHTML = `
                        <audio id="audio-player" controls>
                            <source src="${url}" type="audio/${fileName.split('.').pop()}">
                            Your browser does not support the audio element.
                        </audio>
                    `;
                } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) {
                    previewContent.innerHTML = `
                        <img src="${url}" class="img-fluid" alt="${fileName}">
                    `;
                } else {
                    previewContent.innerHTML = `
                        <div class="alert alert-info">
                            No preview available for this file type.
                        </div>
                    `;
                }
                
                previewModal.show();
            })
            .catch(error => {
                console.error('Error getting signed URL:', error);
                previewContent.innerHTML = `
                    <div class="alert alert-danger">
                        Error loading preview: ${error.message}
                    </div>
                `;
            });
    }

    /**
     * Show delete confirmation modal
     */
    function showDeleteConfirmation(key, name) {
        selectedFileForDeletion = key;
        deleteFilename.textContent = name;
        deleteModal.show();
    }

    /**
     * Delete a file
     */
    function deleteFile() {
        if (!selectedFileForDeletion) return;
        
        fetch(`/api/admin/objects/${encodeURIComponent(selectedFileForDeletion)}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('File deleted:', data);
            deleteModal.hide();
            loadFiles(currentPath);
        })
        .catch(error => {
            console.error('Error deleting file:', error);
            alert(`Error deleting file: ${error.message}`);
            deleteModal.hide();
        });
    }

    /**
     * Format file size in human-readable format
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get the appropriate icon for a file type
     */
    function getFileIcon(mimeType) {
        if (mimeType.startsWith('audio/')) {
            return 'bi-file-music-fill text-success';
        } else if (mimeType.startsWith('image/')) {
            return 'bi-file-image-fill text-info';
        } else {
            return 'bi-file-earmark text-secondary';
        }
    }
    
    /**
     * Show the metadata editor for a file
     */
    function showMetadataEditor(key, name) {
        console.log('Opening metadata editor for:', key, name);
        
        // Set the file info
        metadataFilename.textContent = name;
        metadataFilepath.textContent = key;
        
        // Clear previous form data
        metadataForm.reset();
        customMetadataFields.innerHTML = '';
        metadataStatus.style.display = 'none';
        
        // Show the modal first to ensure it's visible while loading data
        metadataModal.show();
        
        // Fetch existing metadata with cache busting
        fetch(`/api/admin/objects/${encodeURIComponent(key)}/metadata?nocache=${Date.now()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Fetched metadata:', data.metadata);
                
                // Populate the form with existing metadata
                const metadata = data.metadata || {};
                
                // Make a clean copy of metadata without any circular references
                const cleanMetadata = {};
                for (const [key, value] of Object.entries(metadata)) {
                    // Skip any object values to prevent recursion
                    if (typeof value !== 'object' || value === null) {
                        cleanMetadata[key] = value;
                    }
                }
                
                // Store the original metadata for comparison when saving
                window.currentMetadata = cleanMetadata;
                console.log('Stored original metadata:', window.currentMetadata);
                
                // Set standard fields
                metadataArtist.value = metadata.artist || '';
                metadataAlbum.value = metadata.album || '';
                metadataYear.value = metadata.year || '';
                metadataGenre.value = metadata.genre || '';
                metadataCopyright.value = metadata.copyright || '';
                
                // Add custom fields
                const standardFields = ['artist', 'album', 'year', 'genre', 'copyright'];
                let customFieldsAdded = 0;
                
                // Force lowercase keys for consistency
                const normalizedMetadata = {};
                Object.entries(metadata).forEach(([key, value]) => {
                    normalizedMetadata[key.toLowerCase()] = value;
                });
                
                // Clear any existing hidden removed fields
                document.querySelectorAll('.removed-metadata-field').forEach(el => el.remove());
                
                // Process all metadata entries
                Object.entries(normalizedMetadata).forEach(([key, value]) => {
                    const lowerKey = key.toLowerCase();
                    // Skip standard fields, empty values, and the 'metadata' key to prevent recursion
                    if (!standardFields.includes(lowerKey) && 
                        value !== undefined && value !== null && value !== '' &&
                        lowerKey !== 'metadata') {
                        console.log(`Adding custom field: ${key} = ${value}`);
                        addCustomMetadataField(customMetadataFields, key, value);
                        customFieldsAdded++;
                    }
                });
                
                console.log(`Added ${customFieldsAdded} custom metadata fields`);
            })
            .catch(error => {
                console.error('Error fetching metadata:', error);
                metadataStatus.textContent = `Error fetching metadata: ${error.message}`;
                metadataStatus.className = 'alert alert-danger';
                metadataStatus.style.display = 'block';
            });
    }
    
    /**
     * Add a custom metadata field to the form
     */
    function addCustomMetadataField(container, key = '', value = '') {
        const row = document.createElement('div');
        row.className = 'custom-metadata-row';
        
        // Store the original key to track field removal
        const originalKey = key;
        
        row.innerHTML = `
            <div class="input-group">
                <input type="text" class="form-control custom-key" placeholder="Key" value="${key}">
                <input type="text" class="form-control custom-value" placeholder="Value" value="${value}">
                <button type="button" class="btn btn-outline-danger btn-remove-field">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `;
        
        // Store the original key as a data attribute for tracking
        if (originalKey) {
            row.dataset.originalKey = originalKey.toLowerCase();
        }
        
        // Add event listener to remove button
        row.querySelector('.btn-remove-field').addEventListener('click', () => {
            // Mark this field as removed if it had an original key
            if (originalKey) {
                // Create a hidden input to track removed fields
                const removedField = document.createElement('input');
                removedField.type = 'hidden';
                removedField.className = 'removed-metadata-field';
                removedField.value = originalKey.toLowerCase();
                customMetadataFields.appendChild(removedField);
                console.log(`Marked field for removal: ${originalKey}`);
            }
            row.remove();
        });
        
        container.appendChild(row);
    }
    
    /**
     * Load album metadata from the server
     */
    function loadAlbumMetadata(albumName) {
        if (!albumName) return;
        
        const albumJsonPath = `albums/${albumName}/album.json`;
        console.log(`Loading album metadata for ${albumName} from ${albumJsonPath}`);
        
        // Clear the cache to ensure we get fresh data
        window.currentAlbumMetadata = null;
        
        // First try to get the album.json file directly
        fetch(`/api/admin/objects/${encodeURIComponent(albumJsonPath)}/signed-url?nocache=${Date.now()}`)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 404) {
                        console.log('Album.json not found for', albumName);
                        // Try the metadata endpoint as fallback
                        return fetch(`/api/admin/objects/${encodeURIComponent(albumJsonPath)}/metadata?nocache=${Date.now()}`)
                            .then(metadataResponse => {
                                if (!metadataResponse.ok) {
                                    console.log('No album metadata found for', albumName);
                                    window.currentAlbumMetadata = null;
                                    return null;
                                }
                                return metadataResponse.json();
                            })
                            .then(metadataData => {
                                if (metadataData && metadataData.metadata) {
                                    console.log('Album metadata loaded from metadata endpoint:', metadataData.metadata);
                                    
                                    // Normalize metadata keys to lowercase for consistency
                                    const normalizedMetadata = {};
                                    Object.entries(metadataData.metadata).forEach(([key, value]) => {
                                        normalizedMetadata[key.toLowerCase()] = value;
                                    });
                                    
                                    console.log('Normalized metadata from endpoint:', normalizedMetadata);
                                    window.currentAlbumMetadata = normalizedMetadata;
                                    
                                    // Show notification
                                    showAlbumMetadataNotification(albumName);
                                    return normalizedMetadata;
                                }
                                return null;
                            });
                    }
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data) return; // Already handled by the fallback
                
                if (data.url) {
                    // We got a signed URL, fetch the actual JSON content
                    return fetch(`${data.url}${data.url.includes('?') ? '&' : '?'}nocache=${Date.now()}`)
                        .then(jsonResponse => {
                            if (!jsonResponse.ok) {
                                throw new Error(`HTTP error! Status: ${jsonResponse.status}`);
                            }
                            return jsonResponse.json();
                        })
                        .then(albumData => {
                            console.log('Album metadata loaded from album.json:', albumData);
                            // Remove albumName property if it exists
                            const { albumName: _, ...metadataOnly } = albumData;
                            
                            // Normalize metadata keys to lowercase for consistency
                            const normalizedMetadata = {};
                            Object.entries(metadataOnly).forEach(([key, value]) => {
                                normalizedMetadata[key.toLowerCase()] = value;
                            });
                            
                            console.log('Normalized album metadata:', normalizedMetadata);
                            window.currentAlbumMetadata = normalizedMetadata;
                            
                            // Show notification
                            showAlbumMetadataNotification(albumName);
                            return normalizedMetadata;
                        });
                } else if (data.metadata) {
                    console.log('Album metadata loaded:', data.metadata);
                    
                    // Normalize metadata keys to lowercase for consistency
                    const normalizedMetadata = {};
                    Object.entries(data.metadata).forEach(([key, value]) => {
                        normalizedMetadata[key.toLowerCase()] = value;
                    });
                    
                    console.log('Normalized album metadata:', normalizedMetadata);
                    window.currentAlbumMetadata = normalizedMetadata;
                    
                    // Show notification
                    showAlbumMetadataNotification(albumName);
                    return normalizedMetadata;
                }
            })
            .catch(error => {
                console.error('Error loading album metadata:', error);
                window.currentAlbumMetadata = null;
            });
    }
    
    /**
     * Show a notification that album metadata is loaded
     */
    function showAlbumMetadataNotification(albumName) {
        // Display a notification that album metadata is loaded
        const notification = document.createElement('div');
        notification.className = 'alert alert-info alert-dismissible fade show';
        notification.innerHTML = `
            <strong>Album Metadata Loaded</strong>
            <p>Files uploaded to this album will inherit its metadata.</p>
            <div class="mt-2">
                <button type="button" class="btn btn-sm btn-primary apply-to-all-btn">Apply to All Songs</button>
                <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        // Add the notification at the top of the file list
        const fileListContainer = document.querySelector('#file-list-container');
        if (fileListContainer) {
            fileListContainer.insertBefore(notification, fileListContainer.firstChild);
            
            // Add event listener to the Apply to All Songs button
            const applyToAllBtn = notification.querySelector('.apply-to-all-btn');
            if (applyToAllBtn) {
                applyToAllBtn.addEventListener('click', () => {
                    applyMetadataToAllSongs(albumName);
                });
            }
        }
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 10000);
    }
    
    /**
     * Download a specific album as a zip file
     */
    function downloadAlbum(albumName) {
        if (!albumName) return;
        
        // Create a notification to inform the user
        const notification = document.createElement('div');
        notification.className = 'alert alert-info alert-dismissible fade show';
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div>
                    <strong>Downloading album: ${albumName}</strong>
                    <p class="mb-0">Preparing zip file. This may take a moment...</p>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        document.querySelector('.card-body').prepend(notification);
        
        // Create a hidden iframe to handle the download
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `/api/admin/download-album/${encodeURIComponent(albumName)}`;
        document.body.appendChild(iframe);
        
        // Update notification after a short delay
        setTimeout(() => {
            notification.className = 'alert alert-success alert-dismissible fade show';
            notification.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="bi bi-check-circle-fill text-success me-2"></i>
                    <div>
                        <strong>Download started!</strong>
                        <p class="mb-0">Your browser should be downloading the album "${albumName}" as a zip file.</p>
                    </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            
            // Auto-remove the iframe after download should have started
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 5000);
        }, 3000);
    }
    
    /**
     * Apply metadata to all songs in an album
     */
    function applyMetadataToAllSongs(albumName, customMetadata) {
        // Use provided metadata or the current album metadata
        const metadataToApply = customMetadata || window.currentAlbumMetadata;
        
        if (!albumName || !metadataToApply) {
            console.error('No album name or metadata available');
            alert('No metadata available to apply. Please add metadata first.');
            return;
        }
        
        // Store the metadata in window.currentAlbumMetadata for future use
        window.currentAlbumMetadata = metadataToApply;
        
        console.log(`Applying metadata to all songs in album: ${albumName}`, metadataToApply);
        
        // Show confirmation dialog
        if (!confirm(`Are you sure you want to apply the current metadata to ALL songs in the album "${albumName}"? This will overwrite any existing metadata on individual songs.`)) {
            return;
        }
        
        // Display a loading spinner with more detailed information
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'alert alert-info';
        loadingSpinner.id = 'metadata-progress-alert';
        loadingSpinner.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <span>Applying metadata to all songs in the album...</span>
            </div>
            <div class="small text-muted mt-1">This process updates the album.json file and all MP3 files in the album.</div>
        `;
        
        // Set a timeout to update the status if it takes too long
        const updateTimeout = setTimeout(() => {
            const progressAlert = document.getElementById('metadata-progress-alert');
            if (progressAlert) {
                progressAlert.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="spinner-border spinner-border-sm me-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <span>Still applying metadata to all songs...</span>
                    </div>
                    <div class="small text-muted mt-1">This may take longer for albums with many songs or large files.</div>
                `;
            }
        }, 5000);
        
        const fileListContainer = document.querySelector('#file-list-container');
        if (fileListContainer) {
            fileListContainer.insertBefore(loadingSpinner, fileListContainer.firstChild);
        }
        
        // Create a progress element to show which file is being processed
        const progressElement = document.createElement('div');
        progressElement.className = 'progress mt-2';
        progressElement.innerHTML = `
            <div class="progress-bar progress-bar-striped progress-bar-animated" 
                 role="progressbar" 
                 aria-valuenow="0" 
                 aria-valuemin="0" 
                 aria-valuemax="100" 
                 style="width: 0%">
                0%
            </div>
        `;
        loadingSpinner.appendChild(progressElement);
        
        // Call the API to apply metadata to all songs with cache busting and track progress
        fetch(`/api/admin/albums/${encodeURIComponent(albumName)}/apply-metadata?nocache=${Date.now()}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ metadata: metadataToApply })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Metadata applied to all songs:', data);
            
            // Clear the timeout
            clearTimeout(updateTimeout);
            
            // Force remove all loading spinners to ensure none are left behind
            document.querySelectorAll('#metadata-progress-alert').forEach(el => el.remove());
            document.querySelectorAll('.alert-info .spinner-border').forEach(el => {
                const parent = el.closest('.alert');
                if (parent) parent.remove();
            });
            
            // Also remove any other loading indicators that might be present
            document.querySelectorAll('.loading-indicator, .loading-spinner').forEach(el => el.remove());
            document.querySelectorAll('[role="status"]').forEach(el => {
                const parent = el.closest('.alert, .progress');
                if (parent) parent.remove();
            });
            
            // Show success notification with more details
            const successNotification = document.createElement('div');
            successNotification.className = 'alert alert-success alert-dismissible fade show';
            successNotification.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <i class="bi bi-check-circle-fill text-success me-2"></i>
                    <strong>Metadata Applied Successfully!</strong>
                </div>
                <p>${data.message}</p>
                <div class="small text-muted mb-2">The album.json file has been updated and metadata has been applied to all songs.</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            
            if (fileListContainer) {
                fileListContainer.insertBefore(successNotification, fileListContainer.firstChild);
            }
            
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
                successNotification.classList.remove('show');
                setTimeout(() => successNotification.remove(), 500);
            }, 5000);
            
            // Refresh the file list to show updated metadata
            loadFiles(currentPath);
        })
        .catch(error => {
            console.error('Error applying metadata to all songs:', error);
            
            // Clear the timeout
            clearTimeout(updateTimeout);
            
            // Remove the loading spinner
            if (loadingSpinner) {
                loadingSpinner.remove();
            }
            
            // Show error notification with more details
            const errorNotification = document.createElement('div');
            errorNotification.className = 'alert alert-danger alert-dismissible fade show';
            errorNotification.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                    <strong>Error!</strong>
                </div>
                <p>Failed to apply metadata to all songs: ${error.message}</p>
                <div class="small text-muted mb-2">Please try again. If the problem persists, check the server logs for more details.</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            
            if (fileListContainer) {
                fileListContainer.insertBefore(errorNotification, fileListContainer.firstChild);
            }
            
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
                errorNotification.classList.remove('show');
                setTimeout(() => errorNotification.remove(), 500);
            }, 5000);
        });
    }
    
    /**
     * Save metadata for a file
     */
    function saveMetadata() {
        const key = metadataFilepath.textContent;
        if (!key) return;
        
        // Collect metadata from the form
        const metadata = {
            artist: metadataArtist.value,
            album: metadataAlbum.value,
            year: metadataYear.value,
            genre: metadataGenre.value,
            copyright: metadataCopyright.value
        };
        
        // Get the original metadata to compare with
        const originalMetadata = window.currentMetadata || {};
        console.log('Original metadata:', originalMetadata);
        
        // Add custom fields
        const customRows = customMetadataFields.querySelectorAll('.custom-metadata-row');
        customRows.forEach(row => {
            const keyInput = row.querySelector('.custom-key');
            const valueInput = row.querySelector('.custom-value');
            
            if (keyInput && valueInput && keyInput.value.trim() && valueInput.value.trim()) {
                const key = keyInput.value.trim().toLowerCase();
                // Ensure we don't use 'metadata' as a key to prevent recursion
                if (key !== 'metadata') {
                    // Ensure consistent key format (lowercase) for custom metadata
                    metadata[key] = valueInput.value.trim();
                } else {
                    console.warn('Skipping reserved key "metadata" to prevent recursion');
                }
            }
        });
        
        // Process removed fields
        const removedFields = customMetadataFields.querySelectorAll('.removed-metadata-field');
        console.log(`Found ${removedFields.length} explicitly removed fields`);
        removedFields.forEach(field => {
            const removedKey = field.value;
            console.log(`Explicitly removing field: ${removedKey}`);
            // Set the field to an empty string to signal removal
            metadata[removedKey] = '';
        });
        
        // Make sure we don't have any object values that could cause [object Object] issues
        Object.keys(metadata).forEach(key => {
            if (typeof metadata[key] === 'object' && metadata[key] !== null) {
                console.warn(`Converting object value for key ${key} to string to prevent [object Object] issues`);
                metadata[key] = JSON.stringify(metadata[key]);
            }
        });
        
        console.log('Saving metadata:', metadata);
        
        // Show loading status with spinner
        metadataStatus.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <span>Saving metadata...</span>
            </div>
        `;
        metadataStatus.className = 'alert alert-info';
        metadataStatus.style.display = 'block';
        
        // Set a timeout to update the status if it takes too long
        const saveTimeout = setTimeout(() => {
            metadataStatus.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="spinner-border spinner-border-sm me-2" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span>Still saving metadata... This may take a moment for large files.</span>
                </div>
            `;
        }, 3000);
        
        // Check if this is an MP3 file in an album
        const isAlbumMp3 = key.startsWith('albums/') && key.toLowerCase().endsWith('.mp3');
        const albumName = isAlbumMp3 ? key.split('/')[1] : null;
        
        // Check if this is an album.json file
        const isAlbumJson = key.endsWith('/album.json');
        const albumJsonName = isAlbumJson ? key.split('/')[1] : null;
        
        // Ask if the user wants to apply this metadata to all songs in the album
        if (isAlbumMp3 && confirm(`Would you like to apply this metadata to all songs in the "${albumName}" album?`)) {
            // Store the metadata in window.currentAlbumMetadata for future use
            window.currentAlbumMetadata = metadata;
            applyMetadataToAllSongs(albumName, metadata);
            return;
        }
        
        // Save metadata to the server for just this file
        fetch(`/api/admin/objects/${encodeURIComponent(key)}/metadata`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Metadata saved:', data);
            
            // Clear the timeout
            clearTimeout(saveTimeout);
            
            // Show success message
            metadataStatus.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="bi bi-check-circle-fill text-success me-2"></i>
                    <span>Metadata saved successfully!</span>
                </div>
            `;
            metadataStatus.className = 'alert alert-success';
            
            // Close the modal after a delay
            setTimeout(() => {
                metadataModal.hide();
                // Refresh the file list to show updated metadata
                loadFiles(currentPath);
            }, 1500);
            
            // If this is an album.json file, reload the album metadata
            if (key.endsWith('/album.json')) {
                const albumName = key.split('/')[1]; // albums/albumName/album.json
                loadAlbumMetadata(albumName);
            }
        })
        .catch(error => {
            console.error('Error saving metadata:', error);
            
            // Clear the timeout
            clearTimeout(saveTimeout);
            
            // Show error message with icon
            metadataStatus.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                    <span>Error saving metadata: ${error.message}</span>
                </div>
            `;
            metadataStatus.className = 'alert alert-danger';
        });
    }
});

// Initialize the Download All Albums functionality when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    const downloadAllAlbumsBtn = document.getElementById('download-all-albums-btn');
    
    if (downloadAllAlbumsBtn) {
        downloadAllAlbumsBtn.addEventListener('click', function() {
            // Show loading state
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="bi bi-hourglass-split"></i> Preparing Download...';
            this.disabled = true;
            
            // Create a notification to inform the user with progress bar
            const notification = document.createElement('div');
            notification.className = 'alert alert-info alert-dismissible fade show';
            notification.innerHTML = `
                <div>
                    <div class="d-flex align-items-center mb-2">
                        <div class="spinner-border spinner-border-sm me-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <div>
                            <strong>Preparing download...</strong>
                            <p class="mb-0">Creating zip file of all albums. This may take a while for large collections.</p>
                        </div>
                    </div>
                    <div class="progress" style="height: 10px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" 
                             role="progressbar" 
                             style="width: 0%" 
                             aria-valuenow="0" 
                             aria-valuemin="0" 
                             aria-valuemax="100">0%</div>
                    </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            document.querySelector('.card-body').prepend(notification);
            
            // Create a progress checker function
            const progressBar = notification.querySelector('.progress-bar');
            let downloadStarted = false;
            let downloadCompleted = false;
            let progressCheckCount = 0;
            let lastProgressValue = 0;
            let stuckCounter = 0;
            
            const checkDownloadProgress = () => {
                // Only check progress for a reasonable amount of time (5 minutes max)
                if (progressCheckCount > 300 || downloadCompleted) {
                    return;
                }
                
                progressCheckCount++;
                
                // Simulate progress for the first few seconds
                if (!downloadStarted && progressCheckCount < 10) {
                    const simulatedProgress = progressCheckCount * 2;
                    progressBar.style.width = `${simulatedProgress}%`;
                    progressBar.setAttribute('aria-valuenow', simulatedProgress.toString());
                    progressBar.textContent = `${simulatedProgress}%`;
                    setTimeout(checkDownloadProgress, 500);
                    return;
                }
                
                // Make a HEAD request to check if the download is ready
                fetch('/api/admin/download-all-albums', { method: 'HEAD' })
                    .then(response => {
                        // Check if the response is ok
                        if (!response.ok) {
                            if (response.status === 404) {
                                // No albums found
                                downloadCompleted = true;
                                notification.className = 'alert alert-warning alert-dismissible fade show';
                                notification.innerHTML = `
                                    <div class="d-flex align-items-center">
                                        <i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                                        <div>
                                            <strong>No albums found</strong>
                                            <p class="mb-0">There are no albums available to download.</p>
                                        </div>
                                    </div>
                                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                                `;
                                // Reset button state
                                this.innerHTML = originalText;
                                this.disabled = false;
                                return;
                            } else {
                                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                            }
                        }
                        
                        // Check headers for progress information
                        const progress = response.headers.get('X-Progress') || '0';
                        const progressValue = parseInt(progress, 10);
                        const totalFiles = parseInt(response.headers.get('X-Total-Files') || '0', 10);
                        const processedFiles = parseInt(response.headers.get('X-Processed-Files') || '0', 10);
                        
                        console.log(`Download progress: ${progressValue}%, Files: ${processedFiles}/${totalFiles}`);
                        
                        if (progressValue > 0) {
                            downloadStarted = true;
                            progressBar.style.width = `${progressValue}%`;
                            progressBar.setAttribute('aria-valuenow', progressValue.toString());
                            progressBar.textContent = `${progressValue}%`;
                            
                            // Check if progress is stuck
                            if (progressValue === lastProgressValue) {
                                stuckCounter++;
                            } else {
                                stuckCounter = 0;
                                lastProgressValue = progressValue;
                            }
                            
                            // If progress is stuck for too long (30 checks), show a warning
                            if (stuckCounter > 30) {
                                notification.querySelector('p').textContent = 
                                    `Download appears to be stuck at ${progressValue}%. You may want to try again.`;
                            }
                            
                            // If progress is 100%, start the actual download
                            if (progressValue >= 100 && !downloadCompleted) {
                                downloadCompleted = true;
                                startActualDownload();
                                return;
                            }
                        }
                        
                        // Check for timeout - if no progress after 30 seconds, show a warning
                        if (progressCheckCount > 30 && !downloadStarted) {
                            // Show a warning but keep checking
                            notification.querySelector('p').textContent = 
                                'Download is taking longer than expected. This may be due to a large collection or server load.';
                        }
                        
                        // If we've been checking for too long (2 minutes) with no progress, abort
                        if (progressCheckCount > 120 && !downloadStarted) {
                            downloadCompleted = true;
                            notification.className = 'alert alert-danger alert-dismissible fade show';
                            notification.innerHTML = `
                                <div class="d-flex align-items-center">
                                    <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                                    <div>
                                        <strong>Download timed out</strong>
                                        <p class="mb-0">The download preparation timed out. Please try again later.</p>
                                    </div>
                                </div>
                                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                            `;
                            // Reset button state
                            this.innerHTML = originalText;
                            this.disabled = false;
                            return;
                        }
                        
                        // Continue checking progress
                        setTimeout(checkDownloadProgress, 1000);
                    })
                    .catch(error => {
                        console.error('Error checking download progress:', error);
                        progressCheckCount++;
                        
                        // If we've had multiple consecutive errors, show an error message
                        if (progressCheckCount > 10 && !downloadStarted) {
                            downloadCompleted = true;
                            notification.className = 'alert alert-danger alert-dismissible fade show';
                            notification.innerHTML = `
                                <div class="d-flex align-items-center">
                                    <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                                    <div>
                                        <strong>Download failed</strong>
                                        <p class="mb-0">There was an error preparing the download: ${error.message}</p>
                                    </div>
                                </div>
                                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                            `;
                            // Reset button state
                            this.innerHTML = originalText;
                            this.disabled = false;
                            return;
                        }
                        
                        // Continue checking despite errors
                        setTimeout(checkDownloadProgress, 2000);
                    });
            };
            
            // Start checking progress
            checkDownloadProgress();
            
            // Function to start the actual download
            const startActualDownload = () => {
                try {
                    // Create a hidden iframe to handle the download
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = '/api/admin/download-all-albums';
                    document.body.appendChild(iframe);
                    
                    // Reset button state
                    this.innerHTML = originalText;
                    this.disabled = false;
                    
                    // Update notification to success
                    notification.className = 'alert alert-success alert-dismissible fade show';
                    notification.innerHTML = `
                        <div class="d-flex align-items-center">
                            <i class="bi bi-check-circle-fill text-success me-2"></i>
                            <div>
                                <strong>Download started!</strong>
                                <p class="mb-0">Your browser should be downloading the zip file now.</p>
                            </div>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    `;
                    
                    // Auto-remove the iframe after download should have started
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                    }, 5000);
                } catch (error) {
                    console.error('Error starting download:', error);
                    
                    // Reset button state
                    this.innerHTML = originalText;
                    this.disabled = false;
                    
                    // Show error notification
                    notification.className = 'alert alert-danger alert-dismissible fade show';
                    notification.innerHTML = `
                        <div class="d-flex align-items-center">
                            <i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                            <div>
                                <strong>Download failed!</strong>
                                <p class="mb-0">There was an error creating the zip file. Please try again later.</p>
                            </div>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    `;
                }
            };
        });
    }
});
