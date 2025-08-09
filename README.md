# NYC Building Permit Finder

A simple, clean, and responsive web application to search for approved building permits from the NYC Department of Buildings (DOB) NOW database.

## Features

- **Address Search**: Find permits by house number and street name.
- **Nearby Search**: Automatically finds permits for nearby addresses if no exact match is found.
- **Parameter Search**: Click on a permit detail (like 'Work Type' or 'Borough') to find other permits with the same value.
- **Column Filtering**: Show or hide columns in the results table to customize your view.
- **Data Filtering**: Filter results by Borough, Work Type, and Permit Status.
- **Detailed View**: Click on a job filing number to see a detailed panel with all permit information.
- **External Links**: The details panel includes links to the DOB NOW Public Portal, BIS, and ZoLa for further research.
- **Responsive Design**: Works on all devices, from mobile phones to desktops.

## Live Demo

A live demo of this application can be found [here](https://your-github-username.github.io/buildingpermitfinder/).

## Usage

1.  Enter a house number and street name in the search form.
2.  Optionally, select a start date to filter for permits issued after that date.
3.  Click "Search Permits" to see the results.
4.  Use the "Show/Hide Columns" and "Filter Data" buttons to customize your view.
5.  Click on a job filing number to see more details.

## API Information

This application uses the [NYC Open Data API](https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4) for the DOB NOW: Build – Approved Permits dataset.

## Technology Stack

-   HTML5
-   CSS3 with Tailwind CSS
-   Vanilla JavaScript (ES6+)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
