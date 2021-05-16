'use strict';


// Helper for showing an HTML error message within
// the DOM element whose id is 'trujaman_error_body'.
//
// The helper accepts two parameters. The first one is the error message,
// preferably a one-liner explaining (tersely) the main cause of the error.
// The second one can be more verbose and contains the details of the error,
// and will be rendered differently. Usually it's the stringified version of
// the error as returned by the interpreter.
//
// Advanced features can't be used here because this helper is used by
// the feature detection system itself, and it is possible that some
// advanced feature used in this helper is missing, making impossible
// to properly report the missing feature!
function trujamanError (errorMessage, errorDetails) {
    // Show the DOM element for error notifications.
    document.querySelector('#trujaman_error').hidden = false;
    document.querySelector('#trujaman_error_message').innerText = errorMessage;
    document.querySelector('#trujaman_error_details').innerText = errorDetails;
}


// Helper for getting the list of missing features.
function trujamanGetMissingFeatures () {
    // Can't use 'let' because that's still an undetected feature.
    var trujamanMissingFeatures = [];

    // ECMAScript 6 arrow functions.
    try {
        eval('var f = x => x');
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: arrow functions');
    }

    // ECMAScript 6 classes.
    try {
        eval('class X {}');
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: classes');
    }

    // ECMAScript 6 let.
    try {
        eval('let x = true');
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: let statement');
    }

    // ECMAScript 6 const.
    try {
        eval('const x = true');
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: const statement');
    }

    // ECMAScript 6 template strings.
    try {
        eval('let x = `x`');
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: template strings');
    }

    // ECMAScript 6 default parameters.
    try {
        eval('function f (x=1) {}');
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: default function parameters');
    }

    // ECMAScript 6 async functions.
    try {
        eval('async function f() {}');
    } catch (e) {
        trujamanMissingFeatures.push('JavaScript ES6: async functions');
    }

    // ECMAScript 6 promises.
    if (typeof Promise === 'undefined') {
        trujamanMissingFeatures.push('JavaScript ES6: promises');
    }

    // Service workers.
    if ('serviceWorker' in navigator === false) {
        trujamanMissingFeatures.push('Progressive Web Apps: service workers');
    }

    // Cookies (needed for registering a service worker).
    if (!navigator.cookieEnabled) {
        trujamanMissingFeatures.push('Progressive Web Apps: cookies');
    }

    // Cache storage.
    if ('caches' in window === false) {
        trujamanMissingFeatures.push('Progressive Web Apps: cache storage');
    }

    // HTML5 File API.
    if (!('File' in window && 'Blob' in window && 'FileReader' in window && 'FileList' in window)) {
        trujamanMissingFeatures.push('HTML5: File API');
    }

    return trujamanMissingFeatures;
}


window.addEventListener('load', function () {
    // If there are missing features, notify the user and stop.
    const trujamanMissingFeatures = trujamanGetMissingFeatures();
    if (trujamanMissingFeatures.length) {
        // Show the list of missing features.
        var message = 'Este navegador no es compatible con:';
        var details = '';
        trujamanMissingFeatures.forEach(function (feature) {details += feature + '<br>';});
        trujamanError(message, details);
        return;
    }

    // From this point on, advanced features can be used.

    // Show version number.
    navigator.serviceWorker.ready
    .then(() => {
        fetch('version')
        .then(response => response.text())
        .then(version => {
            let trujamanVersion = document.querySelector('#trujaman_version');
            trujamanVersion.hidden = false;
            trujamanVersion.textContent += 'v' + version;
        });
    });

    // Handle controller change.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });

    // Handle PWA installation offers.
    // For now, just prevent the default install handler to appear.
    window.addEventListener('beforeinstallprompt', event => event.preventDefault());

    // Register service worker.
    navigator.serviceWorker.register('sw.js')
    .catch(error => {
        trujamanError('Falló una parte esencial.', error);
        return Promise.reject(null);
    })
    // Service worker successfully registered, proceed with setting up the app.
    .then(() => fetch('formats.json'))
    .then(response => response.json().catch(error => {
        trujamanError('No se pudo procesar la lista de formatos.', error);
        return Promise.reject(null);
    }))
    .then(formats => {  // Set up the core of the application and the UI.
        // Update job template with the list of formats.
        const formatListTemplate = document.querySelector('#trujaman_job_template .trujaman_job_formats_list');
        for (const format in formats) {
            let aParagraph = document.createElement('p');
            aParagraph.innerText = format;
            formatListTemplate.appendChild(aParagraph);
        }

        // Set up file picker.
        const filePicker = document.querySelector('#trujaman_filepicker');
        filePicker.hidden = false;
        filePicker.querySelector('#trujaman_filepicker_button').addEventListener('click', () => {
            // Propagate the click.
            filePicker.querySelector('#trujaman_filepicker_input').click();
        });

        // Set up jobs container
        const jobsContainer = document.querySelector('#trujaman_jobs');
        jobsContainer.hidden = false;

        const trujamanCreateJobs = function (iterable) {
            for (let i = 0; i < iterable.length; i++) {
                // Add the container itself to the page.
                const theJob = new TrujamanJob(iterable[i], formats).element;
                if (theJob) jobsContainer.appendChild(theJob);
            }
        }

        // If the browser supports file drag and drop, enable it for creating jobs.
        // This is not tested in feature detection because this is entirely optional.
        if (('draggable' in filePicker) || ('ondragstart' in filePicker && 'ondrop' in filePicker)) {
            const theDropzone = document.querySelector('#trujaman_dropzone');
            theDropzone.dataset.state = 'hidden';
            theDropzone.hidden = false;

            // This is needed because the drag and drop overlay is HIDDEN, so it wouldn't get the event.
            window.ondragenter = () => theDropzone.dataset.state = 'visible';

            // Prevent the browser from opening the file.
            theDropzone.ondragenter = event => event.preventDefault();  // FIXME: is this needed?
            theDropzone.ondragover = event => event.preventDefault();

            // Hide the drag and drop overlay if the user didn't drop the file.
            theDropzone.ondragleave = () => theDropzone.dataset.state = 'hidden';

            theDropzone.ondrop = event => {
                event.preventDefault();  // Prevent the browser from opening the file.
                theDropzone.dataset.state = 'dismissed';
                trujamanCreateJobs(event.dataTransfer.files);
            };
        }

        // Create new file processor with the selected file.
        filePicker.firstElementChild.addEventListener('change', event => {
            // Create the needed jobs.
            trujamanCreateJobs(event.target.files);
            // Or the event won't be fired again if the user selects the same file...
            event.target.value = null;
        });
    })
    .catch(error => {  // For unhandled errors.
        if (error === null) return;
        trujamanError('Se produjo un error inesperado.', error);
    });
});


class TrujamanJob {
    constructor (file, formats) {
        // Do not add duplicate jobs.
        for (const jobElement of document.querySelectorAll('.trujaman_job').values()) {
            if (jobElement.getAttribute('filename') === file.name) {
                this.element = null;
                return;
            }
        }

        this.file = file;
        this.formats = formats;

        // Create the file reader.
        this.reader = new FileReader();

        // Create the UI elements for the job by copying the existing template.
        // That way, this code can be more agnostic about the particular layout of the UI elements.
        this.element = document.querySelector('#trujaman_job_template').cloneNode(true);
        this.element.hidden = false;
        this.element.removeAttribute('id');
        this.element.setAttribute('filename', file.name);
        this.element.querySelector('.trujaman_job_filename').textContent = file.name;

        // A status area, to keep the end user informed.
        this.status = this.element.querySelector('.trujaman_job_status');

        // A cancel button, to cancel current loading operation.
        this.cancelButton = this.element.querySelector('.trujaman_job_cancel_button');
        this.cancelButton.onclick = () => this.reader.abort();

        // A retry button, to retry current loading operation, if previously aborted.
        this.retryButton = this.element.querySelector('.trujaman_job_retry_button');
        this.retryButton.onclick = () => this.readFile();

        // A dropdown control, to choose the download format from a list.
        this.formatsList = this.element.querySelector('.trujaman_job_formats_list');
        this.downloadDropdown = this.element.querySelector('.trujaman_job_download_dropdown');
        this.downloadDropdown.onclick = () => this.formatsList.hidden = !this.formatsList.hidden;

        // A dismiss button, to delete the current job.
        this.element.querySelector('.trujaman_job_dismiss_button').addEventListener('click', event => {
            // Remove the onloadend handler, to avoid messing with the UI once the element is removed.
            // This is because that handler modifies DOM elements within the job UI element.
            this.reader.onloadend = null;

            // Remove job UI element.
            const theJob = event.target.closest('.trujaman_job');
            theJob.parentNode.removeChild(theJob);

            // Abort file reading, just in case.
            this.reader.abort();
        }, {once: true});

        // Finally, read the file.
        this.readFile();
    }

    // Read the file associated with this job.
    readFile () {
        // Handling errors here is simpler and more convenient than having two
        // nearly identical handlers for 'onerror' and 'onabort', since this
        // event will fire no matter whether the file reading process finished
        // successfully or not.
        this.reader.onloadend = event => {
            let error = this.reader.error || this.reader.trujamanError;

            this.cancelButton.hidden = true;
            if (error) {
                this.retryButton.hidden = false;
                let errorMessage = 'ERROR: ';
                switch (error.name) {
                    case 'AbortError':
                        errorMessage += 'lectura cancelada';
                        break;
                    case 'FileTooLargeError':
                        errorMessage += 'el fichero es muy grande';
                        break;
                    case 'NotFoundError':
                        errorMessage += 'el fichero no existe';
                        break;
                    case 'NotReadableError':
                        errorMessage += 'el fichero no tiene permisos de lectura';
                        break;
                    case 'SecurityError':
                        errorMessage += 'el fichero no se puede leer de forma segura';
                        break;
                    default:
                        errorMessage += 'el fichero no pudo ser leído';
                        break;
                }
                this.status.innerHTML = `${errorMessage} <span class="trujaman_tty">(${error.name})</span>.`;
            } else {
                this.status.textContent = `El fichero se leyó correctamente.`;
                this.downloadDropdown.hidden = false;
            }
        };

        if (this.file.size > 99 * 1024 * 1024) {  // Absolutely arbitrary maximum file size...
            // Use a fake event to handle this 'error' so all error handling happens in one place.
            let event = new ProgressEvent('loadend', {loaded: 0, total: 0});
            this.reader.trujamanError = new DOMException('', 'FileTooLargeError');  // Fake event, fake error...
            this.reader.dispatchEvent(event);
        } else {
            this.retryButton.hidden = true;
            this.cancelButton.hidden = false;
            this.reader.readAsText(this.file);
        }
    }
}