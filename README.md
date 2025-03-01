# LATAM Airlines Flight Scraper

This script scrapes flight information from LATAM Airlines website and saves it to CSV files. It supports both regular price and points redemption searches, as well as one-way and round-trip flights.

## Prerequisites

- Python 3.8 or higher
- Chrome browser installed

## Setup

1. Install the required packages:
```bash
pip install -r requirements.txt
```

2. Configure the environment:
   - Copy the `.env.example` file to `.env`
   - Add your LATAM account credentials:
     ```
     LATAM_EMAIL=your_email_or_cpf
     LATAM_PASSWORD=your_password
     ```

3. Create an input file:
   - Copy `input_example.json` to `input.json`
   - Modify the search parameters according to your needs

## Input File Format

The input file should be a JSON file with the following structure:

```json
{
    "searches": [
        {
            "origin": "GRU",
            "destination": "MAD",
            "trip_type": "round_trip",
            "outbound_dates": {
                "start": "2024-07-15",
                "end": "2024-07-20"
            },
            "return_dates": {
                "start": "2024-08-10",
                "end": "2024-08-15"
            },
            "use_points": false
        },
        {
            "origin": "GRU",
            "destination": "MIA",
            "trip_type": "one_way",
            "outbound_dates": {
                "start": "2024-09-10",
                "end": "2024-09-15"
            },
            "use_points": true
        }
    ]
}
```

Each search object requires:
- `origin`: Origin airport code (e.g., GRU, MIA)
- `destination`: Destination airport code
- `trip_type`: Either "one_way" or "round_trip"
- `outbound_dates`: Object with start and end dates for outbound flight search
- `use_points`: Boolean indicating whether to search for points redemption
- `return_dates`: Required for round_trip searches, object with start and end dates

## Usage

Run the script:
```bash
python latam_scraper.py --input input.json
```

Or use the default input file name:
```bash
python latam_scraper.py
```

The script will:
1. Load the search parameters from the input file
2. Log in to your LATAM account
3. Search for flights according to each set of parameters
4. Save the results to CSV files in the `flight_data` directory

## Output

The script creates CSV files in the `flight_data` directory with names following this pattern:
```
flights_[ORIGIN]_[DESTINATION]_[points/cash]_[one_way/round_trip]_[TIMESTAMP].csv
```

Each CSV file contains:
- Flight date
- Origin and destination
- Departure and arrival times
- Price (in currency or points)
- Flight duration
- Trip type (one_way/outbound/return)

## Notes

- The script uses Selenium WebDriver to automate Chrome browser
- First run will require logging in to your LATAM account
- The script may need adjustments if LATAM's website structure changes
- Be mindful of rate limiting and don't make too many requests in a short time 