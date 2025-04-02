document.addEventListener('DOMContentLoaded', () => {
    // Current path in the file browser
    let currentPath = '';
    // Currently selected file for deletion
    let selectedFileForDeletion = null;

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

    // Bootstrap modals
    const uploadModal = new bootstrap.Modal(document.getElementById('upload-modal'));
    const createAlbumModal = new bootstrap.Modal(document.getElementById('create-album-modal'));
    const previewModal = new bootstrap.Modal(document.getElementById('preview-modal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('delete-modal'));

    // Initialize the file browser
    loadFiles(currentPath);

    // Event listeners
    refreshBtn.addEventListener('click', () => loadFiles(currentPath));
    
    // File upload events
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelection);
    uploadBtn.addEventListener('click', uploadFiles);
    
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
    
    // Delete confirmation event
    confirmDeleteBtn.addEventListener('click', deleteFile);

    /**
     * Load files from the server
     */
    function loadFiles(path) {
        currentPath = path;
        updateBreadcrumb(path);
        
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
                    html += `
                        <div class="file-item" data-type="folder" data-path="${prefix.Prefix}">
                            <i class="bi bi-folder-fill file-icon folder-icon"></i>
                            <div class="file-info">
                                <div class="file-name">${folderName}</div>
                                <div class="file-meta text-muted small">Folder</div>
                            </div>
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
                        loadFiles(item.dataset.path);
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
        
        progress.style.display = 'block';
        progressBar.style.width = '0%';
        
        // Upload each file
        Array.from(files).forEach((file, index) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', currentPath);
            
            // Use XMLHttpRequest to track upload progress
            const xhr = new XMLHttpRequest();
            
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
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log('File uploaded successfully');
                    
                    // If this is the last file, close the modal and refresh the file list
                    if (index === files.length - 1) {
                        uploadModal.hide();
                        loadFiles(currentPath);
                        
                        // Reset the file input
                        fileInput.value = '';
                        uploadList.innerHTML = '';
                        progress.style.display = 'none';
                    }
                } else {
                    console.error('Error uploading file:', xhr.statusText);
                    alert(`Error uploading file: ${xhr.statusText}`);
                    progress.style.display = 'none';
                }
            });
            
            // Setup error handler
            xhr.addEventListener('error', () => {
                console.error('Error uploading file: Network error');
                alert('Error uploading file: Network error');
                progress.style.display = 'none';
            });
            
            // Open and send the request
            xhr.open('POST', '/api/admin/upload');
            xhr.send(formData);
        });
    }

    /**
     * Create a new album
     */
    function createAlbum() {
        const albumName = albumNameInput.value.trim();
        
        if (!albumName) {
            alert('Please enter an album name');
            return;
        }
        
        fetch('/api/admin/create-album', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ albumName })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Album created:', data);
            createAlbumModal.hide();
            loadFiles(currentPath);
            
            // Reset the input
            albumNameInput.value = '';
        })
        .catch(error => {
            console.error('Error creating album:', error);
            alert(`Error creating album: ${error.message}`);
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
});
