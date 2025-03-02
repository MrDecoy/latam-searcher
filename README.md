# LATAM Flight Searcher

A powerful browser extension script that helps you search and compare flight information from LATAM Airlines, making it easier to track and compare flight prices over multiple dates.

## Quick Start Guide

- Install Tampermonkey extension in your browser ([Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo), [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/), [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd))
- Install the LATAM Flight Searcher script from [Greasyfork](https://greasyfork.org/en/scripts/528484-latam-flight-searcher)
- Visit [LATAM Airlines](https://www.latamairlines.com)
- Use the searcher interface in the top-right corner to start searching

## Detailed Installation Instructions

### 1. Installing Tampermonkey

1. Visit your browser's extension store:
   - [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. Click "Add to [Browser]" or "Install"
3. Follow any additional browser prompts to complete the installation

### 2. Installing the LATAM Flight Searcher

1. Visit the [LATAM Flight Searcher on Greasyfork](https://greasyfork.org/en/scripts/528484-latam-flight-searcher)
2. Click the green "Install" button
3. Tampermonkey will open a new tab showing the script
4. Click "Install" or "Update" to add the script to Tampermonkey

## Using the Searcher

### Basic Usage

1. Visit [LATAM Airlines](https://www.latamairlines.com)
2. Look for the searcher interface in the top-right corner of the page
3. Fill in your search criteria:
   - Origin airport (e.g., GRU for São Paulo)
   - Destination airport (e.g., MAD for Madrid)
   - Trip type (One Way or Round Trip)
   - Cabin class (Economy or Business)
   - Date ranges for departure (and return if round trip)
   - Whether to search using points or money

4. Click "Start Search" to begin

### Advanced Features

- **Draggable Interface**: Move the searcher window anywhere on the screen
- **Minimize/Maximize**: Collapse the interface when not in use
- **Progress Tracking**: Monitor the search progress in real-time
- **CSV Export**: Results are automatically saved to a CSV file

### Understanding the Results

The searcher will save a CSV file containing:
- Flight dates and times
- Origin and destination airports
- Flight duration
- Prices (in currency or points)
- Taxes and fees information
- Additional flight details

## Tips for Best Results

1. **Date Ranges**: Keep date ranges reasonable (1-2 weeks) for faster results
2. **Browser Performance**: Avoid running other intensive tasks while searching
3. **Network Connection**: Ensure a stable internet connection
4. **Multiple Searches**: Use the JSON input for multiple route configurations

## Troubleshooting

If you encounter issues:

1. **Script Not Working**
   - Ensure Tampermonkey is properly installed
   - Check if the script is enabled in Tampermonkey
   - Try refreshing the page

2. **No Results**
   - Verify the airport codes are correct
   - Ensure the dates are valid
   - Check if the route is operated by LATAM

3. **Slow Performance**
   - Reduce the date range
   - Close unnecessary browser tabs
   - Clear browser cache

## Support

For issues or questions:
1. Visit the [Greasyfork script page](https://greasyfork.org/en/scripts/528484-latam-flight-searcher)
2. Leave a comment or feedback
3. Check for script updates regularly

## Disclaimer

This script was created as a test project and is intended for educational purposes only. It serves as a demonstration of browser automation and data processing techniques. The tool should be used responsibly and in accordance with LATAM Airlines' terms and conditions. Any automated access to the website should be done at a reasonable rate that does not disrupt their services.

Key points:
- Educational project for learning purposes
- Not for commercial use
- Respect website terms and conditions
- Use responsibly and ethically
- Do not abuse or overuse the tool
- Not affiliated with LATAM Airlines 