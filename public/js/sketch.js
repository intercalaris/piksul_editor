const sketch = document.getElementById("sketch");
let projectId = sketch.dataset.projectId;
const editedImageFilename = sketch.dataset.editedImage;
let blockSize = parseInt(sketch.dataset.blockSize, 10);
const colorPicker = document.getElementById("color-picker");
const drawButton = document.getElementById("draw-button");
const eraseButton = document.getElementById("erase-button");
const undoButton = document.getElementById("undo-button");
const resetButton = document.getElementById("reset-button");
const colorPalette = document.getElementById("color-palette");
const saveProjectButton = document.getElementById("save-project-button");
const downloadButton = document.getElementById("download-button");
const imageCanvas = document.getElementById("image-canvas");
const canvasContainer = document.getElementById("canvas-container");
const gridCanvas = document.getElementById("grid-canvas");
const imageCtx = imageCanvas.getContext("2d", { willReadFrequently: true });
const gridCtx = gridCanvas.getContext("2d");
const paintFillButton = document.getElementById("paint-fill-button");
let isDrawing = false;
let isErasing = false;
let isPaintFilling = false;
let isTouchMoved = false;
let currentColor = colorPicker.value;
let originalImage;
let undoStack = [];

function fitCanvasToViewport() {
    // At <=768px the layout stacks (canvas above, tools below), so the canvas
    // must give up vertical room to keep the tools on-screen.
    const stacked = window.innerWidth <= 768;
    const maxW = window.innerWidth * 0.87;
    const maxH = window.innerHeight * (stacked ? 0.5 : 0.82);
    const scale = Math.min(maxW / imageCanvas.width, maxH / imageCanvas.height);
    const cssW = Math.round(imageCanvas.width * scale);
    const cssH = Math.round(imageCanvas.height * scale);
    imageCanvas.style.width = cssW + 'px';
    imageCanvas.style.height = cssH + 'px';
    gridCanvas.style.width = cssW + 'px';
    gridCanvas.style.height = cssH + 'px';
}

window.addEventListener('resize', () => {
    if (originalImage) fitCanvasToViewport();
});

const loadEditedImage = async () => {
    let img = new Image();
    let imageUrl;
    if (localStorage.getItem("editedImage")) {
        imageUrl = localStorage.getItem("editedImage");
        blockSize = 1;
        console.log("Loading image from localStorage.");
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
            fitCanvasToViewport();
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
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
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

const highlightSelectedTool = () => {
    drawButton.classList.remove("selected");
    eraseButton.classList.remove("selected");
    paintFillButton.classList.remove("selected");

    if (isPaintFilling) {
        paintFillButton.classList.add("selected");
    } else if (isErasing) {
        eraseButton.classList.add("selected");
    } else{
        drawButton.classList.add("selected");
    }
};

undoButton.addEventListener("click", (e) => {
    e.preventDefault();
    if (undoStack.length === 0) {
        alert("No actions to undo.");
        return;
    }
    undoButton.classList.add("selected");
    const previousState = undoStack.pop();
    const img = new Image();
    img.src = previousState;
    img.onload = () => {
        imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        imageCtx.drawImage(img, 0, 0);
    };
    setTimeout(() => {
        undoButton.classList.remove("selected");
    }, 400);
});


const floodFill = (startX, startY) => {
    const imageData = imageCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
    const pixelData = imageData.data;

    // get starting pixel position
    const pixelIndex = (startY * imageCanvas.width + startX) * 4;
    const startColor = {
        r: pixelData[pixelIndex],
        g: pixelData[pixelIndex + 1],
        b: pixelData[pixelIndex + 2],
        a: pixelData[pixelIndex + 3],
    };

    // if startColor matches currentColor, return
    const currentColorRGB = hexToRGB(currentColor);
    if (
        startColor.r === currentColorRGB.r &&
        startColor.g === currentColorRGB.g &&
        startColor.b === currentColorRGB.b
    ) {
        return;
    }

    const pixelStack = [[startX, startY]];

    const matchStartColor = (index) => {
        return (
            pixelData[index] === startColor.r &&
            pixelData[index + 1] === startColor.g &&
            pixelData[index + 2] === startColor.b &&
            pixelData[index + 3] === startColor.a
        );
    };

    const colorPixel = (index) => {
        const { r, g, b } = hexToRGB(currentColor);
        pixelData[index] = r;
        pixelData[index + 1] = g;
        pixelData[index + 2] = b;
        pixelData[index + 3] = 255;
    };
    

    while (pixelStack.length) {
        let [x, y] = pixelStack.pop();
        let pixelPos = (y * imageCanvas.width + x) * 4;
    
        // up while color match
        while (y >= 0 && matchStartColor(pixelPos)) {
            y--;
            pixelPos -= imageCanvas.width * 4;
        }
    
        pixelPos += imageCanvas.width * 4;
        y++;
        let reachLeft = false;
        let reachRight = false;
    
        // down while color match
        while (y < imageCanvas.height && matchStartColor(pixelPos)) {
            colorPixel(pixelPos);
    
            if (x > 0) {
                if (matchStartColor(pixelPos - 4)) {
                    if (!reachLeft) {
                        pixelStack.push([x - 1, y]);
                        reachLeft = true;
                    }
                } else {
                    reachLeft = false;
                }
            }
    
            if (x < imageCanvas.width - 1) {
                if (matchStartColor(pixelPos + 4)) {
                    if (!reachRight) {
                        pixelStack.push([x + 1, y]);
                        reachRight = true;
                    }
                } else {
                    reachRight = false;
                }
            }
    
            y++;
            pixelPos += imageCanvas.width * 4;
        }
    }
    

    imageCtx.putImageData(imageData, 0, 0);
};

const hexToRGB = (hex) => {
    const bigint = parseInt(hex.slice(1), 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
    };
};

// reset to original image
resetButton.addEventListener("click", (e) => {
    e.preventDefault();
    if (!originalImage) {
        console.error("Original image not loaded, cannot reset.");
        return;
    }
    resetButton.classList.add("selected");
    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    imageCtx.drawImage(originalImage, 0, 0);
    drawGrid(); 
    undoStack = []; 
    setTimeout(() => {
        resetButton.classList.remove("selected");
    }, 400);
});

// get top 16 colors from image
const extractTopColors = () => {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = imageCanvas.width;
    tempCanvas.height = imageCanvas.height;

    tempCtx.drawImage(originalImage, 0, 0);
    const imageData = tempCtx.getImageData(
        0,
        0,
        tempCanvas.width,
        tempCanvas.height
    ).data;

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
            if (isErasing) {
                isErasing = false;
            }
            currentColor = rgbToHex(color);
            colorPicker.value = currentColor;
            highlightSelectedTool();
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
        blockSize, // inital position and size
        x,
        y,
        blockSize,
        blockSize // target position and size
    );
};


const getScaledCursorPosition = (event) => {
    const rect = imageCanvas.getBoundingClientRect();
    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
    };
};

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
    e.preventDefault();
    const { x, y } = snapToGrid(getScaledCursorPosition(e).x, getScaledCursorPosition(e).y);

    if (isPaintFilling) {
        saveStateForUndo();
        floodFill(x, y);
    } else {
        saveStateForUndo();
        isDrawing = true; 
        if (isErasing) {
            eraseBlock(x, y);
        } else {
            drawBlock(x, y, currentColor);
        }
    }
});

imageCanvas.addEventListener("mousemove", (e) => {
    if (!isDrawing || isPaintFilling) return; 
    const { x, y } = snapToGrid(getScaledCursorPosition(e).x, getScaledCursorPosition(e).y);

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
        isTouchMoved = false;
        const { x, y } = snapToGrid(getScaledTouchPosition(e).x, getScaledTouchPosition(e).y);

        if (isPaintFilling) {
            saveStateForUndo();
            floodFill(x, y);
        } else {
            isDrawing = true;
            saveStateForUndo();
            if (isErasing) {
                eraseBlock(x, y);
            } else {
                drawBlock(x, y, currentColor);
            }
        }
    }
});

imageCanvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const { x, y } = snapToGrid(getScaledTouchPosition(e).x, getScaledTouchPosition(e).y);
        const deltaX = Math.abs(x - snapToGrid(getScaledTouchPosition(e).x, getScaledTouchPosition(e).y).x);
        const deltaY = Math.abs(y - snapToGrid(getScaledTouchPosition(e).x, getScaledTouchPosition(e).y).y);

        if (deltaX > 2 || deltaY > 2) {
            isTouchMoved = true;
        }
        // don't want drawing if paintfilling active
        if (isPaintFilling) {
            return;
        }

        if (isDrawing) {
            e.preventDefault();
            if (isErasing) {
                eraseBlock(x, y);
            } else {
                drawBlock(x, y, currentColor);
            }
        }
    }
});


imageCanvas.addEventListener("touchend", (e) => {
    if (isPaintFilling && !isTouchMoved) {
        const touch = e.changedTouches[0];
        const { x, y } = snapToGrid(getScaledTouchPosition(e).x, getScaledTouchPosition(e).y);
        saveStateForUndo();
        floodFill(x, y);
    }
    isDrawing = false;
    isTouchMoved = false;
});

colorPicker.addEventListener("change", (e) => {
    currentColor = e.target.value;
    if (isErasing) {
        isErasing = false;
    }
    highlightSelectedTool();
});



drawButton.addEventListener("click", (e) => {
    e.preventDefault();
    isErasing = false;
    isPaintFilling = false;
    highlightSelectedTool(); 
});

eraseButton.addEventListener("click", (e) => {
    e.preventDefault();
    isErasing = true;
    isPaintFilling = false;
    isDrawing = false;
    highlightSelectedTool();
});

paintFillButton.addEventListener("click", (e) => {
    e.preventDefault();
    isPaintFilling = true;
    isErasing = false;
    isDrawing = false;
    highlightSelectedTool(); 
});


// save final project as both final and original image for gallery
saveProjectButton?.addEventListener("click", async (e) => {
    e.preventDefault();
    const blob = await new Promise((resolve) =>
        imageCanvas.toBlob(resolve, "image/png")
    );
    const storedBlockSize =
        parseInt(localStorage.getItem("blockSize"), 10) || 16;
    const storedPaletteSize =
        parseInt(localStorage.getItem("paletteSize"), 10) || 128;
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
            projectId = result.project_id; // Update ID for later saves
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
