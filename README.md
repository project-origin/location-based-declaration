# Location Based Declaration

This web service generates an emission and fuel declaration based on your hourly electricity consumption and your geografical location (DK1 and DK2) in Denmark. The service retrieves your hourly electricity consumption from eloverblik.dk and merges it with emission and fuel data from energinet.dk (EDS). The web service runs entirely on the client side and the access to eloverblik.dk is granted using a refresh token you can create on eloveblik.dk.

To improve performance, the data from EDS is retrieved offline and converted into an easily accessable data format using a Python script. The Python script retrieves data for a given year and generates two JSON files _year_\_emission*data.json and \_year*\_fuel*data.json which get placed in the folder \_data*.

The web service also relies on reference data for DK1 and DK2 which must be placed in a file called _year_\_references.json in the folder _data_.

## Usage

The Python program to retrieve data from EDS is run using the following command:

```python
python3 ./retrieve_fuel_and_emission_data.py <year>
```

This program needs only be run one time per year.

## Help

### You get **_ModuleNotFoundError: No module named 'requests'_** when retrieving fuel and emission data"

This means you haven't installed the Python requirements yet. Please run this command:

```python
pip install -r requirements.txt
```
