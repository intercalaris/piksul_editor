const sketch = document.getElementById("sketch");
let projectId = sketch.dataset.projectId;
const editedImageFilename = sketch.dataset.editedImage;
let blockSize = parseInt(sketch.dataset.blockSize, 10);
const colorPicker = document.getElementById("colorPicker");
const eraserButton = document.getElementById("eraserButton");
const undoButton = document.getElementById("undoButton");
const resetButton = document.getElementById("resetButton");
const colorPalette = document.getElementById("colorPalette");
const saveProjectButton = document.getElementById("saveProjectButton");
const downloadButton = document.getElementById("downloadButton");
const imageCanvas = document.getElementById("imageCanvas");
const canvasContainer = document.getElementById("canvas-container");
const gridCanvas = document.getElementById("gridCanvas");
const imageCtx = imageCanvas.getContext("2d");
const gridCtx = gridCanvas.getContext("2d");
let isDrawing = false;
let isErasing = false;
let currentColor = colorPicker.value;
let originalImage;
let undoStack = []; 

const loadEditedImage = async () => {
    let img = new Image();
    let imageUrl;
    if (localStorage.getItem("editedImage")) {
        imageUrl = localStorage.getItem("editedImage");
        console.log("Loading image from localStorage.");
        const storedBlockSize = parseInt(localStorage.getItem("blockSize"), 10);
        if (storedBlockSize && !isNaN(storedBlockSize)) {
            blockSize = storedBlockSize;
        } else {
            console.warn("Block size not found in localStorage, using default.");
            blockSize = 16;
        }
    } else {
        console.error("No image source");
        return;
    }
    img.src = imageUrl;
    await new Promise((resolve, reject) => {
        img.onload = () => {
            imageCanvas.width = img.width;
            imageCanvas.height = img.height;
            gridCanvas.width = imageCanvas.width;
            gridCanvas.height = imageCanvas.height;
            imageCtx.drawImage(img, 0, 0);          
            drawGrid();
            originalImage = img;
            saveStateForUndo();
            extractTopColors();
            console.log("Image loaded.");
            resolve();
        };
        img.onerror = (e) => {
            console.error("Error loading image:", e);
            reject(e);
        };
    });

};


const drawGrid = () => {
    // clear previous grid
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height); 
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

const snapToGrid = (x, y) => {
    return {
        x: Math.floor(x / blockSize) * blockSize,
        y: Math.floor(y / blockSize) * blockSize,
    };
};

// save canvas for undo
const saveStateForUndo = () => {
    undoStack.push(imageCanvas.toDataURL());
    if (undoStack.length > 20) {
        undoStack.shift(); // 20 undos
    }
};

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

// reset to original image
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

// get top 16 colors from image
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
      const a = imageData[i + 3];
      if (a === 0) continue; // ignore transparent pixels
      const color = `rgb(${r},${g},${b})`;
      colorCounts[color] = (colorCounts[color] || 0) + 1;
  }

  const topColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([color]) => color);

  // render color palette
  colorPalette.innerHTML = "";
  topColors.forEach((color) => {
      const colorDiv = document.createElement("div");
      colorDiv.className = "color-swatch";
      colorDiv.style.backgroundColor = color;
      colorDiv.addEventListener("click", () => {
          currentColor = color; 
          colorPicker.value = rgbToHex(color); // color picker
      });
      colorPalette.appendChild(colorDiv);
  });
};

// convert rgb to hex for updating color picker
const rgbToHex = (rgb) => {
    const rgbArray = rgb.match(/\d+/g).map(Number);
    return `#${rgbArray.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

// draw block
const drawBlock = (x, y, color) => {
    imageCtx.fillStyle = color;
    imageCtx.fillRect(x, y, blockSize, blockSize);
};

// erase block
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
        blockSize, // origin position and size
        x,
        y,
        blockSize,
        blockSize // target position and size
    );
};

// get cursor position
const getScaledCursorPosition = (event) => {
    const rect = imageCanvas.getBoundingClientRect();
    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
    };
};

// get touch position
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

imageCanvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        e.preventDefault();
        saveStateForUndo(); 
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

colorPicker.addEventListener("change", (e) => {
    currentColor = e.target.value;
});

eraserButton.addEventListener("click", (e) => {
    e.preventDefault();
    isErasing = !isErasing;
    eraserButton.textContent = isErasing ? "Drawing Mode" : "Eraser";
});

// save final project as both final and original image for gallery
saveProjectButton?.addEventListener("click", async () => {
    const blob = await new Promise((resolve) =>
        imageCanvas.toBlob(resolve, "image/png")
    );
    const storedBlockSize = parseInt(localStorage.getItem("blockSize"), 10) || 16;
    const storedPaletteSize = parseInt(localStorage.getItem("paletteSize"), 10) || 128;
    const formData = new FormData();
    formData.append("original_image", new File([blob], "original.png"));
    formData.append("edited_image", new File([blob], "edited.png"));
    formData.append("block_size", storedBlockSize);
    formData.append("palette_size", storedPaletteSize);
    if (projectId) formData.append("project_id", projectId);
    try {
        const response = await fetch("/projects", {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            throw new Error("Failed to save the project");
        }
        const result = await response.json();
        if (result.project_id) {
            console.log("Project saved successfully:", result);
            projectId = result.project_id; // update id for later saves
        } else {
            console.error("Invalid response: missing project ID");
        }
    } catch (error) {
        console.error("Error saving the project:", error);
    }
});


downloadButton.addEventListener("click", (e) => {
    e.preventDefault();
    const link = document.createElement("a");
    link.href = imageCanvas.toDataURL("image/png");
    link.download = `piksul.png`;
    link.click();
});

loadEditedImage().catch((err) =>
    console.error("Error loading edited image:", err)
);
