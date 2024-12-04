const uploadInput = document.getElementById('upload');
const snapButton = document.getElementById('snapButton');
const downloadButton = document.getElementById('downloadButton');
const gridSizeInput = document.getElementById('gridSizeInput');
const toleranceInput = document.getElementById('toleranceInput');
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
    // use size of container
    const comparisonRect = comparison.getBoundingClientRect();
    divisor.style.backgroundSize = `${comparisonRect.width}px ${comparisonRect.height}px`;
    divisor.style.backgroundRepeat = "no-repeat";
    divisor.style.backgroundPosition = "top left";
    downloadButton.style.display = 'inline-block';
    saveProjectButton.style.display = 'inline-block';
    console.log("Snapped image setup complete.");
}
function populateGridAndTolerance(image, defaultGridSize, defaultTolerance) {
    const tolerance = defaultTolerance;
    const gridSize = estimateGridSize(image, tolerance);
    gridSizeInput.value = gridSize;
    toleranceInput.value = tolerance;
    console.log("Estimated grid size:", gridSize, "and tolerance:", tolerance);
    return { gridSize, tolerance };
}
// OPEN PROJECT FUNCTION UNFINISHED... figuring out logic for it
function openProject(click) {
    const openProjectButton = click.target;
    const project = openProjectButton.closest('.project-card');
    const projectID = project.getAttribute("data-id");
    //load original image and save to const
    //load edited image and save to const
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
    originalFileName = file.name.split('.')[0];
    projectId = null; // reset project ID
    editedImageURL = null; // reset snapped image
    divisor.style.backgroundImage = ''; // clear snapped image UI
    downloadButton.style.display = 'none'; // hide download button

    const originalImageURL = URL.createObjectURL(file);
    originalBlob = await fetch(originalImageURL).then((res) => res.blob()); // save uploaded image  b l o b

    setupOriginalImage(originalImageURL, document.querySelector('#comparison figure'));

    const img = new Image();
    img.onload = () => {
        controls.style.display = 'block';
        comparison.style.display = 'block';
        const { gridSize, tolerance } = populateGridAndTolerance(img, estimatedGridSize, estimatedTolerance);
        snapButton.style.display = 'inline-block';
    };
    img.src = originalImageURL;
});
saveProjectButton?.addEventListener('click', async () => {
    const formData = new FormData();
    formData.append('original_image', new File([originalBlob], 'original.png'));
    formData.append('edited_image', new File([editedBlob], 'edited.png'));
    formData.append('grid_size', gridSizeInput.value);
    formData.append('tolerance', toleranceInput.value);
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
snapButton?.addEventListener('click', () => {
    const userGridSize = parseInt(gridSizeInput.value, 10) || estimatedGridSize;
    const userTolerance = parseInt(toleranceInput.value, 10) || estimatedTolerance;
    snapToGrid(userGridSize, userTolerance);
});
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


// MAFFAMATIKS
function estimateGridSize(img, tolerance) {
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

    // Analyze horizontal and vertical lines to estimate grid size
    for (let y = 0; y < height; y++) {
        let prevColor = [data[y * width * 4], data[y * width * 4 + 1], data[y * width * 4 + 2]];
        let count = 1;
        for (let x = 1; x < width; x++) {
            const index = (y * width + x) * 4;
            const currentColor = [data[index], data[index + 1], data[index + 2]];
            if (colorsAreDifferent(prevColor, currentColor, tolerance)) {
                if (count > 1) {
                    colorChanges.push(count);
                }
                count = 1;
            } else {
                count++;
            }
            prevColor = currentColor;
        }
    }

    for (let x = 0; x < width; x++) {
        let prevColor = [data[x * 4], data[x * 4 + 1], data[x * 4 + 2]];
        let count = 1;
        for (let y = 1; y < height; y++) {
            const index = (y * width + x) * 4;
            const currentColor = [data[index], data[index + 1], data[index + 2]];
            if (colorsAreDifferent(prevColor, currentColor, tolerance)) {
                if (count > 1) {
                    colorChanges.push(count);
                }
                count = 1;
            } else {
                count++;
            }
            prevColor = currentColor;
        }
    }

    console.log(`Total color changes: ${colorChanges.length}`);

    // Sort color changes to evaluate thresholds
    colorChanges.sort((a, b) => a - b);
    const percentile75Index = Math.floor(0.75 * colorChanges.length);
    const lengthThreshold = colorChanges[percentile75Index];

    // Filter using the 75th percentile to remove larger homogeneous regions
    const filteredChanges = colorChanges.filter(value => value <= lengthThreshold);

    console.log(`Filtered color changes count: ${filteredChanges.length}`);
    console.log(`Sample of filtered changes (first 20): ${filteredChanges.slice(0, 20).join(', ')}`);

    // Calculate the frequency of each grid size in filteredChanges
    const frequencyMap = {};
    filteredChanges.forEach(value => {
        frequencyMap[value] = (frequencyMap[value] || 0) + 1;
    });

    const sortedFrequencies = Object.entries(frequencyMap).sort((a, b) => b[1] - a[1]);

    console.log(
        `Top 10 most frequent run lengths: ${sortedFrequencies.slice(0, 10).map(([value, freq]) => `${value}: ${freq}`).join(', ')}` 
    );

    // Generate images for top 3 grid size candidates and select the best visually
    const topCandidates = sortedFrequencies.slice(0, 3).map(([value]) => parseInt(value));
    const evaluationScores = topCandidates.map(candidateSize => {
        return evaluateSnapping(img, candidateSize, tolerance);
    });

    const bestCandidateIndex = evaluationScores.indexOf(Math.min(...evaluationScores));
    const finalGridSize = topCandidates[bestCandidateIndex];

    console.log(`Estimated grid size: ${finalGridSize}`);
    return finalGridSize;
}

function evaluateSnapping(img, gridSize, tolerance) {
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


function snapToGrid(gridSize, tolerance) {
    console.log("Snapping to grid with size:", gridSize, "and tolerance:", tolerance);

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
