const sketch = document.getElementById("sketch");
const projectId = sketch.dataset.projectId;
const editedImageFilename = sketch.dataset.editedImage;
const editedImageUrl = `/gallery/image/${editedImageFilename}`;
const blockSize = parseInt(sketch.dataset.blockSize, 10);
const colorPicker = document.getElementById("colorPicker");
const eraserButton = document.getElementById("eraserButton");
const undoButton = document.getElementById("undoButton");
const resetButton = document.getElementById("resetButton");
const colorPalette = document.getElementById("colorPalette");
const saveButton = document.getElementById("saveButton");
const downloadButton = document.getElementById("downloadButton");
const imageCanvas = document.getElementById("imageCanvas");
const gridCanvas = document.getElementById("gridCanvas");
const imageCtx = imageCanvas.getContext("2d");
const gridCtx = gridCanvas.getContext("2d");
let isDrawing = false;
let isErasing = false;
let currentColor = colorPicker.value;
let originalImage;
let undoStack = []; // For undo functionality

// Load edited image onto canvas
const loadEditedImage = async () => {
    if (!editedImageFilename) {
        console.error("Edited image filename is missing.");
        return;
    }
    const img = new Image();
    img.src = editedImageUrl;

    await new Promise((resolve, reject) => {
        img.onload = () => {
            imageCanvas.width = img.width;
            imageCanvas.height = img.height;
            gridCanvas.width = imageCanvas.width;
            gridCanvas.height = imageCanvas.height;
            imageCtx.drawImage(img, 0, 0);
            drawGrid();
            originalImage = img; // Save original image for erasing/resetting
            saveStateForUndo(); // Save initial state
            extractTopColors(); // Extract top colors for the palette
            resolve();
        };
        img.onerror = (e) => {
            console.error("Error loading edited image:", e);
            reject(e);
        };
    });
};

// Draw snapping grid
const drawGrid = () => {
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height); // Clear previous grid
    gridCtx.save();
    gridCtx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    gridCtx.lineWidth = 1;

    for (let x = 0; x < gridCanvas.width; x += blockSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, gridCanvas.height);
        gridCtx.stroke();
    }

    for (let y = 0; y < gridCanvas.height; y += blockSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(gridCanvas.width, y);
        gridCtx.stroke();
    }

    gridCtx.restore();
};

// Snap coordinates to grid
const snapToGrid = (x, y) => {
    return {
        x: Math.floor(x / blockSize) * blockSize,
        y: Math.floor(y / blockSize) * blockSize,
    };
};

// Save canvas state for undo
const saveStateForUndo = () => {
    undoStack.push(imageCanvas.toDataURL());
    if (undoStack.length > 20) {
        undoStack.shift(); // Limit undo stack size
    }
};

// Undo the last action
undoButton.addEventListener("click", () => {
    if (undoStack.length === 0) {
        alert("No actions to undo.");
        return;
    }
    const previousState = undoStack.pop();
    const img = new Image();
    img.src = previousState;
    img.onload = () => {
        imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        imageCtx.drawImage(img, 0, 0);
    };
});

// Reset the canvas to the original image
resetButton.addEventListener("click", () => {
    if (!originalImage) {
        console.error("Original image not loaded, cannot reset.");
        return;
    }
    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    imageCtx.drawImage(originalImage, 0, 0);
    drawGrid(); // Redraw the grid
    undoStack = []; // Clear undo stack
});

// Extract top 16 colors from the image
const extractTopColors = () => {
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width = imageCanvas.width;
  tempCanvas.height = imageCanvas.height;

  tempCtx.drawImage(originalImage, 0, 0);
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;

  const colorCounts = {};
  for (let i = 0; i < imageData.length; i += 4) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3]; // Alpha channel
      if (a === 0) continue; // Ignore transparent pixels

      const color = `rgb(${r},${g},${b})`;

      colorCounts[color] = (colorCounts[color] || 0) + 1;
  }

  // Sort colors by frequency and select top 16
  const topColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([color]) => color);

  // Render the color palette
  colorPalette.innerHTML = ""; // Clear existing palette
  topColors.forEach((color) => {
      const colorDiv = document.createElement("div");
      colorDiv.className = "color-swatch";
      colorDiv.style.backgroundColor = color;
      colorDiv.addEventListener("click", () => {
          currentColor = color; // Update current color on selection
          colorPicker.value = rgbToHex(color); // Sync with the color picker
      });
      colorPalette.appendChild(colorDiv);
  });
};

// Convert RGB to Hex for syncing color picker
const rgbToHex = (rgb) => {
    const rgbArray = rgb.match(/\d+/g).map(Number);
    return `#${rgbArray.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

// Draw a block
const drawBlock = (x, y, color) => {
    imageCtx.fillStyle = color;
    imageCtx.fillRect(x, y, blockSize, blockSize);
};

// Erase a block
const eraseBlock = (x, y) => {
    if (!originalImage) {
        console.error("Original image not loaded, cannot erase.");
        return;
    }
    imageCtx.drawImage(
        originalImage,
        x,
        y,
        blockSize,
        blockSize, // Source position and size
        x,
        y,
        blockSize,
        blockSize // Target position and size
    );
};

// Get cursor position for mouse events
const getScaledCursorPosition = (event) => {
    const rect = imageCanvas.getBoundingClientRect();
    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
    };
};

// Get touch position for touch events
const getScaledTouchPosition = (event) => {
    const rect = imageCanvas.getBoundingClientRect();
    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;
    const touch = event.touches[0];
    return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
    };
};

// Event Handlers for mouse
imageCanvas.addEventListener("mousedown", (e) => {
    saveStateForUndo(); // Save state for undo
    isDrawing = true;
    const { x, y } = snapToGrid(...Object.values(getScaledCursorPosition(e)));

    if (isErasing) {
        eraseBlock(x, y);
    } else {
        drawBlock(x, y, currentColor);
    }
});

imageCanvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    const { x, y } = snapToGrid(...Object.values(getScaledCursorPosition(e)));

    if (isErasing) {
        eraseBlock(x, y);
    } else {
        drawBlock(x, y, currentColor);
    }
});

imageCanvas.addEventListener("mouseup", () => {
    isDrawing = false;
});

imageCanvas.addEventListener("mouseleave", () => {
    isDrawing = false;
});

// Event Handlers for touch
imageCanvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        e.preventDefault();
        saveStateForUndo(); // Save state for undo
        isDrawing = true;
        const { x, y } = snapToGrid(
            ...Object.values(getScaledTouchPosition(e))
        );

        if (isErasing) {
            eraseBlock(x, y);
        } else {
            drawBlock(x, y, currentColor);
        }
    }
});

imageCanvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1) {
        e.preventDefault();
        if (!isDrawing) return;
        const { x, y } = snapToGrid(
            ...Object.values(getScaledTouchPosition(e))
        );

        if (isErasing) {
            eraseBlock(x, y);
        } else {
            drawBlock(x, y, currentColor);
        }
    }
});

imageCanvas.addEventListener("touchend", (e) => {
    if (e.touches.length === 0) {
        isDrawing = false;
    }
});

// Other event listeners
colorPicker.addEventListener("change", (e) => {
    currentColor = e.target.value;
});

eraserButton.addEventListener("click", (e) => {
    e.preventDefault();
    isErasing = !isErasing;
    eraserButton.textContent = isErasing ? "Drawing Mode" : "Eraser";
});

saveButton.addEventListener("click", async (e) => {
    e.preventDefault();
    const blob = await new Promise((resolve) =>
        imageCanvas.toBlob(resolve, "image/png")
    );

    const formData = new FormData();
    formData.append("project_id", projectId);
    formData.append("edited_image", blob);

    try {
        const response = await fetch("/projects", {
            method: "POST",
            body: formData,
        });

        if (response.ok) {
            alert("Project saved successfully!");
        } else {
            alert("Failed to save project.");
        }
    } catch (err) {
        console.error("Error saving project:", err);
        alert("An error occurred while saving the project.");
    }
});

downloadButton.addEventListener("click", (e) => {
    e.preventDefault();
    const link = document.createElement("a");
    link.href = imageCanvas.toDataURL("image/png");
    link.download = "edited_image.png";
    link.click();
});

// Initialize
loadEditedImage().catch((err) =>
    console.error("Error loading edited image:", err)
);
