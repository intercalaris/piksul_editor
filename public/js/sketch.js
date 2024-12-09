const sketch = document.getElementById("sketch");
const projectId = sketch.dataset.projectId;
const editedImageFilename = sketch.dataset.editedImage; 
const editedImageUrl = `/gallery/image/${editedImageFilename}`; 
const blockSize = parseInt(sketch.dataset.blockSize, 10);
const colorPicker = document.getElementById("colorPicker");
const eraserButton = document.getElementById("eraserButton");
const saveButton = document.getElementById("saveButton");
const downloadButton = document.getElementById("downloadButton");
const imageCanvas = document.getElementById("imageCanvas");
const gridCanvas = document.getElementById("gridCanvas");
const imageCtx = imageCanvas.getContext("2d");
const gridCtx = gridCanvas.getContext("2d");
let isDrawing = false;
let isErasing = false;
let currentColor = colorPicker.value;

// Store the edited image
let originalImage;

// Load edited image onto canvas
const loadEditedImage = async () => {
  if (!editedImageFilename) {
    console.error("Edited image filename is missing.");
    return;
  }
  const img = new Image();
  console.log(editedImageUrl);
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
      x, y, blockSize, blockSize, // Source position and size
      x, y, blockSize, blockSize  // Target position and size
    );
  };
  

const getScaledCursorPosition = (event) => {
  const rect = imageCanvas.getBoundingClientRect();
  const scaleX = imageCanvas.width / rect.width; // ratio of internal to CSS rendered size so painting is accurate
  const scaleY = imageCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
};

// Event Handlers
imageCanvas.addEventListener("mousedown", (e) => {
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
  const blob = await new Promise((resolve) => imageCanvas.toBlob(resolve, "image/png"));

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
