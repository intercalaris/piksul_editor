const uploadInput = document.getElementById('upload');
const snapButton = document.getElementById('snapButton');
const downloadButton = document.getElementById('downloadButton');
const gridSizeInput = document.getElementById('gridSizeInput');
// const toleranceInput = document.getElementById('toleranceInput');
const controls = document.getElementById('controls');
const divisor = document.getElementById('divisor');
const slider = document.getElementById('slider');
const comparison = document.getElementById('comparison');
const startProjectButton = document.getElementById('startProjectButton');
const saveProjectButton = document.getElementById('saveProjectButton');
const openProjectButtons = document.querySelectorAll('.open-project');
const deleteProjectButtons = document.querySelectorAll('.delete-project');
const viewSavedProjectsButton = document.getElementById('viewSavedProjectsButton');

let originalImage = null;
let editedImageURL = null;
let originalBlob = null;
let editedBlob = null;
let originalFileName = ''; 
let estimatedGridSize = 8;
let estimatedTolerance = 30;

function setupOriginalImage(url, imgElement) {
    const img = new Image();
    img.onload = () => {
        const aspectRatio = img.width / img.height;
        comparison.style.aspectRatio = `${aspectRatio}`;
        imgElement.style.backgroundImage = `url(${url})`;
        console.log("Original image loaded successfully.");
    };
    img.src = url;
}

function setupSnappedImage(editedImageURL) {
    divisor.style.backgroundImage = `url(${editedImageURL})`;
    const comparisonRect = comparison.getBoundingClientRect();
    divisor.style.backgroundSize = `${comparisonRect.width}px ${comparisonRect.height}px`;
    divisor.style.backgroundRepeat = "no-repeat";
    divisor.style.backgroundPosition = "top left";
    // Show buttons only after snapping
    downloadButton.classList.remove('hidden');
    saveProjectButton.classList.remove('hidden');
    console.log("Snapped image setup complete.");
}

function populateGridValue(img) {
    const gridSize = estimateGridSize(img);
    gridSizeInput.value = gridSize;
    console.log("Estimated grid size:", gridSize);
    return gridSize;
}

async function deleteProject(click) {
    console.log('delete commencing');
    const deleteProjectButton = click.target;
    const project = deleteProjectButton.closest(".project-card");
    const projectID = project.getAttribute("data-id");
    try {
        const response = await fetch(`/projects/${projectID}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          window.location.reload();
        }
      } catch (error) {
        console.error("Error deleting project:", error);
      }
}

uploadInput?.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    originalFileName = file.name.split('.')[0];
    projectId = null; // Reset project ID TODO, CHECK IF DELETE
    editedImageURL = null; // Reset snapped image
    divisor.style.backgroundImage = ''; // Clear snapped image UI
    // reset visibility for new uploads
    downloadButton.classList.add('hidden');
    saveProjectButton.classList.add('hidden');
    const originalImageURL = URL.createObjectURL(file);
    originalBlob = await fetch(originalImageURL).then((res) => res.blob()); // Save uploaded image blob
    setupOriginalImage(originalImageURL, document.querySelector('#comparison figure'));

    const img = new Image();
    img.onload = () => {
        controls.classList.remove('hidden'); // Show grid controls
        comparison.classList.remove('hidden'); // Show comparison block
        snapButton.classList.remove('hidden'); // Show snap button
        populateGridValue(img);
    };
    img.src = originalImageURL;
});



saveProjectButton?.addEventListener('click', async () => {
    const formData = new FormData();
    formData.append('original_image', new File([originalBlob], 'original.png'));
    formData.append('edited_image', new File([editedBlob], 'edited.png'));
    formData.append('grid_size', gridSizeInput.value);
    if (projectId) formData.append('project_id', projectId);
    try {
        const response = await fetch('/projects', {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            throw new Error('Failed to save the project');
        }
        const result = await response.json();
        if (result.project_id) {
            console.log('Project saved successfully:', result);
            projectId = result.project_id; // update ID for later saves
        } else {
            console.error('Invalid response: missing project ID');
        }
    } catch (error) {
        console.error('Error saving the project:', error);
    }
});

snapButton?.addEventListener('click', snapButtonClick);

function snapButtonClick() {
    const userGridSize = parseInt(gridSizeInput.value, 10) || estimatedGridSize;
    snapToGrid(userGridSize);
    // Show buttons only after snapping
    downloadButton.classList.remove('hidden');
    saveProjectButton.classList.remove('hidden');
}



downloadButton?.addEventListener('click', () => {
    if (editedImageURL) {
        const link = document.createElement('a');
        link.href = editedImageURL;
        link.download = `piksul_${originalFileName}.png`;
        link.click();
    }
});
deleteProjectButtons?.forEach(button => button.addEventListener("click", deleteProject));
openProjectButtons?.forEach(button => button.addEventListener("click", openProject));

slider?.addEventListener('input', () =>  {
    divisor.style.width = slider.value + "%";
});






// SET UP EDITOR AFTER 'OPEN PROJECT' IN GALLERY IS CLICKED AND ENDPOINT REDIRECTS
document.addEventListener('DOMContentLoaded', () => {
    const editorMain = document.getElementById('editor');
    if (editorMain) {
        const projectId = editorMain.dataset.projectId;
        const originalImageFilename = editorMain.dataset.originalImage;
        const gridSize = editorMain.dataset.gridSize;
        console.log({projectId, originalImageFilename, gridSize})
        if (projectId && originalImageFilename) {
            const imagePath = `/gallery/image/${originalImageFilename}`; // fetch image from backend
            // Use image setup function (same as for uploaded inputs)
            setupOriginalImage(imagePath, document.querySelector('#comparison figure'));
            const img = new Image();
            img.onload = () => {
                controls.classList.remove('hidden'); // Show grid controls
                comparison.classList.remove('hidden'); // Show comparison block
                snapButton.classList.remove('hidden'); // Show snap button
                // populateGridValue(img, gridSize); 
                gridSizeInput.value = gridSize;
                snapButtonClick();

            };
            img.src = imagePath;
        }
    }
});












// CALCULATIONS
function estimateGridSize(img) {
    const tolerance = 30;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    let colorChanges = [];

    function analyzeLine(primaryLimit, secondaryLimit, getIndex) {
        for (let primary = 0; primary < primaryLimit; primary++) {
            let prevColor = [data[getIndex(primary, 0)], data[getIndex(primary, 0) + 1], data[getIndex(primary, 0) + 2]];
            let count = 1;
            for (let secondary = 1; secondary < secondaryLimit; secondary++) {
                const index = getIndex(primary, secondary);
                const currentColor = [data[index], data[index + 1], data[index + 2]];
                if (colorsAreDifferent(prevColor, currentColor, tolerance)) {
                    if (count > 1) colorChanges.push(count);
                    count = 1;
                } else {
                    count++;
                }
                prevColor = currentColor;
    }}}

    analyzeLine(height, width, (y, x) => (y * width + x) * 4); // Horizontal
    analyzeLine(width, height, (x, y) => (y * width + x) * 4); // Vertical

    console.log(`Total color changes: ${colorChanges.length}`);
    colorChanges.sort((a, b) => a - b);
    const lengthThreshold = colorChanges[Math.floor(0.75 * colorChanges.length)];
    const filteredChanges = colorChanges.filter(value => value <= lengthThreshold);

    const frequencyMap = {};
    filteredChanges.forEach(value => {
        frequencyMap[value] = (frequencyMap[value] || 0) + 1;
    });

    const sortedFrequencies = Object.entries(frequencyMap).sort((a, b) => b[1] - a[1]);
    const topCandidates = sortedFrequencies.slice(0, 3).map(([value]) => parseInt(value));
    const evaluationScores = topCandidates.map(candidateSize => evaluateSnapping(img, candidateSize));
    const bestCandidateIndex = evaluationScores.indexOf(Math.min(...evaluationScores));
    return topCandidates[bestCandidateIndex];
}

function evaluateSnapping(img, gridSize) {
    console.log(`Evaluating snapping quality for grid size: ${gridSize}`);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    let totalDeviation = 0;

    // Loop through each grid cell
    for (let y = 0; y < height; y += gridSize) {
        for (let x = 0; x < width; x += gridSize) {
            const centerX = Math.min(x + Math.floor(gridSize / 2), width - 1);
            const centerY = Math.min(y + Math.floor(gridSize / 2), height - 1);
            const index = (centerY * width + centerX) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            let cellDeviation = 0;
            let cellPixelCount = 0;

            let colorSumR = 0, colorSumG = 0, colorSumB = 0;
            let colorValues = [];

            // Calculate deviation for each pixel in the grid cell from the sampled color
            for (let offsetY = 0; offsetY < gridSize; offsetY++) {
                for (let offsetX = 0; offsetX < gridSize; offsetX++) {
                    const pixelX = x + offsetX;
                    const pixelY = y + offsetY;
                    if (pixelX < width && pixelY < height) {
                        const newIndex = (pixelY * width + pixelX) * 4;
                        const dr = data[newIndex] - r;
                        const dg = data[newIndex + 1] - g;
                        const db = data[newIndex + 2] - b;
                        cellDeviation += Math.abs(dr) + Math.abs(dg) + Math.abs(db);
                        cellPixelCount++;

                        // Calculate color statistics for weight calculation
                        colorSumR += data[newIndex];
                        colorSumG += data[newIndex + 1];
                        colorSumB += data[newIndex + 2];
                        colorValues.push([data[newIndex], data[newIndex + 1], data[newIndex + 2]]);
                    }
                }
            }

            // Calculate mean color for the cell
            const meanR = colorSumR / cellPixelCount;
            const meanG = colorSumG / cellPixelCount;
            const meanB = colorSumB / cellPixelCount;

            // Calculate standard deviation (or variance) of colors in the cell
            let colorVariance = 0;
            for (let i = 0; i < colorValues.length; i++) {
                const [rVal, gVal, bVal] = colorValues[i];
                colorVariance += Math.pow(rVal - meanR, 2) + Math.pow(gVal - meanG, 2) + Math.pow(bVal - meanB, 2);
            }
            colorVariance /= cellPixelCount;

            // Apply a stronger non-linear transformation to create significant differences
            const contrastWeight = 1 + Math.pow(colorVariance, 2);

            // Apply weight to cell deviation
            if (cellPixelCount > 0) {
                cellDeviation /= cellPixelCount;
            }
            totalDeviation += cellDeviation * contrastWeight;
        }
    }

    console.log(`Total deviation for grid size ${gridSize}: ${totalDeviation}`);
    return totalDeviation;
}

function colorsAreDifferent(color1, color2, tolerance) {
    return (
        Math.abs(color1[0] - color2[0]) > tolerance ||
        Math.abs(color1[1] - color2[1]) > tolerance ||
        Math.abs(color1[2] - color2[2]) > tolerance
    );
}


function snapToGrid(gridSize) {
    console.log("Snapping to grid with size:", gridSize, "and tolerance: 30");

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.src = document.querySelector('#comparison figure').style.backgroundImage.slice(5, -2);

    img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        for (let y = 0; y < height; y += gridSize) {
            for (let x = 0; x < width; x += gridSize) {
                const centerX = Math.min(x + Math.floor(gridSize / 2), width - 1);
                const centerY = Math.min(y + Math.floor(gridSize / 2), height - 1);
                const index = (centerY * width + centerX) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                const a = data[index + 3];

                for (let offsetY = 0; offsetY < gridSize; offsetY++) {
                    for (let offsetX = 0; offsetX < gridSize; offsetX++) {
                        const pixelX = x + offsetX;
                        const pixelY = y + offsetY;
                        if (pixelX < width && pixelY < height) {
                            const newIndex = (pixelY * width + pixelX) * 4;
                            data[newIndex] = r;
                            data[newIndex + 1] = g;
                            data[newIndex + 2] = b;
                            data[newIndex + 3] = a;
                        }
                    }
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
        editedImageURL = canvas.toDataURL('image/png');
        editedBlob = await fetch(editedImageURL).then((res) => res.blob());
        setupSnappedImage(editedImageURL); 
    };
}
