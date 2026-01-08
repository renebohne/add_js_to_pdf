This repository uses nodejs to create a webservice that expects the user to upload a PDF file and a JS file and returns a new PDF file that has the javascript code injected.

This is work in progess.

## Deployment with Docker

You can run this application using Docker and Docker Compose. This is ideal for VPS environments running Ubuntu and tools like Dockge.

### Prerequisites

- Docker
- Docker Compose

### Running with Docker Compose

1.  Clone this repository to your server (ensure you include submodules):
    ```bash
    git clone --recurse-submodules https://github.com/renebohne/add_js_to_pdf.git
    cd add_js_to_pdf
    ```
    *If you have already cloned the repository without submodules, run:*
    ```bash
    git submodule update --init --recursive
    ```

2.  Start the container:
    ```bash
    docker compose up -d --build
    ```

3.  The application will be available at `http://<your-server-ip>:3010`.

### Using with Dockge

If you are using [Dockge](https://github.com/louislam/dockge), the easiest way to run this is to clone the repository directly into your Dockge stacks directory.

1.  **Locate your Stacks Directory**: By default, this is often `/opt/stacks`.
2.  **Clone the Repository**:
    ```bash
    cd /opt/stacks
    git clone --recurse-submodules https://github.com/renebohne/add_js_to_pdf.git js-to-pdf
    ```
    *(Note: If you forget `--recurse-submodules`, the Docker build will automatically attempt to fetch the missing dependency for you.)*

3.  **Refresh Dockge**:
    *   Go to your Dockge dashboard.
    *   Click the **"Scan Stacks Folder"** button (or "Rescan").
    *   You should see `js-to-pdf` appear in your list of stacks.

4.  **Deploy**:
    *   Select the `js-to-pdf` stack.
    *   Click **"Deploy"** (or "Update" -> "Build").

**Note:** This application runs a Java-based tool (`JS2PDFInjector`). The Docker image automatically installs the necessary Java runtime (OpenJDK 17) and handles the dependencies.