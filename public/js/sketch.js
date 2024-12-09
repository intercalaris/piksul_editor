const sketch = document.getElementById("sketch");
const projectId = sketch.dataset.projectId;
const editedImageFilename = sketch.dataset.editedImage; 
const editedImageUrl = `/gallery/image/${editedImageFilename}`; 
const blockSize = parseInt(sketch.dataset.blockSize, 10);
const canvas = document.getElementById("drawingCanvas");
const colorPicker = document.getElementById("colorPicker");
const eraserButton = document.getElementById("eraserButton");
const saveButton = document.getElementById("saveButton");
const downloadButton = document.getElementById("downloadButton");
let isDrawing = false;
let isErasing = false;
let currentColor = colorPicker.value;
const ctx = canvas.getContext("2d");

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
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      drawGrid();
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
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += blockSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += blockSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.restore();
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
  ctx.fillStyle = color;
  ctx.fillRect(x, y, blockSize, blockSize);
};

// Erase a block
const eraseBlock = (x, y) => {
  ctx.clearRect(x, y, blockSize, blockSize);
  drawGrid();
};

// Helper: Get scaled cursor position
const getScaledCursorPosition = (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width; // ratio of internal to CSS rendered size so painting still accurate
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
};

// Event Handlers
canvas.addEventListener("mousedown", (e) => {
  isDrawing = true;
  const { x, y } = snapToGrid(...Object.values(getScaledCursorPosition(e)));

  if (isErasing) {
    eraseBlock(x, y);
  } else {
    drawBlock(x, y, currentColor);
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDrawing) return;
  const { x, y } = snapToGrid(...Object.values(getScaledCursorPosition(e)));

  if (isErasing) {
    eraseBlock(x, y);
  } else {
    drawBlock(x, y, currentColor);
  }
});

canvas.addEventListener("mouseup", () => {
  isDrawing = false;
});

canvas.addEventListener("mouseleave", () => {
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
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

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
  link.href = canvas.toDataURL("image/png");
  link.download = "edited_image.png";
  link.click();
});

// Initialize
loadEditedImage().catch((err) =>
  console.error("Error loading edited image:", err)
);
