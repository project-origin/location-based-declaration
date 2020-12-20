import csv
import json
import requests
from requests.utils import requote_uri

VALID_AREAS = ['DK']
YEAR = '2019'


def retrieve_fuel_data():
    url = 'https://www.energidataservice.dk/proxy/api/datastore_search_sql?sql=\
          SELECT "HourUTC", "PriceArea", "DKFuelType", "ConsumedDK" \
          FROM "declarationproductiontypeshour" \
          ORDER BY "HourUTC" ASC'

    response = requests.get(requote_uri(url))
    records = response.json()['result']['records']

    filtered_year = list(filter(lambda x: x['HourUTC'].startswith(YEAR), records))
    return filtered_year


def retrieve_emission_data():
    url = 'https://www.energidataservice.dk/proxy/api/datastore_search_sql?sql=\
           SELECT "HourUTC", "PriceArea", "Co2PerkWh" \
           FROM "declarationemissionhour" \
           ORDER BY "HourUTC" ASC'

    response = requests.get(requote_uri(url))
    records = response.json()['result']['records']

    filtered_year = list(filter(lambda x: x['HourUTC'].startswith(YEAR), records))
    return filtered_year


def calculate_kwh_per_hour(fuel_data):
    kwh_hourly = {}
    fuel_types = set()

    for row in fuel_data:
        hour = row['HourUTC']
        area = row['PriceArea']
        consumed = row['ConsumedDK'] * 1000 # convert from MWh to kWh.

        kwh_hourly[(hour, area)] = kwh_hourly.get((hour, area), 0) + consumed

        fuel_types.add(row['DKFuelType'])

    return list(fuel_types), kwh_hourly

def fill_missing_fuel_type_per_hour(fuel_data):
    filled_fuel_data = {}

    for area in VALID_AREAS:
        filled_fuel_data[area] = {}

    for row in fuel_data:
        hour = row['HourUTC']
        area = row['PriceArea']

        if not hour in filled_fuel_data[area]:
            filled_fuel_data[area][hour] = {}

        consumed = row['ConsumedDK'] * 1000 # convert from MWh to kWh
        filled_fuel_data[area][hour][row['DKFuelType']] = filled_fuel_data[area][hour].get(row['DKFuelType'], 0) + consumed

    return filled_fuel_data

def convert_fuel_data(fuel_data):
    fuel_types, kwh_hourly = calculate_kwh_per_hour(fuel_data)

    converted_data = {}
    for area in VALID_AREAS:
        converted_data[area] = {}
        for fuel_type in fuel_types:
            converted_data[area][fuel_type] = []

    filled_fuel_data = fill_missing_fuel_type_per_hour(fuel_data)

    for area in VALID_AREAS:
        for hour in filled_fuel_data[area]:
            for fuel_type in fuel_types:

                kwh = filled_fuel_data[area][hour].get(fuel_type, 0)
                procentwise = kwh / kwh_hourly[(hour, area)]

                converted_data[area][fuel_type].append({'HourUTC': hour,'ProcentwiseGross': procentwise})

    for area in VALID_AREAS:
        for fuel_type in fuel_types:
            converted_data[area][fuel_type] = sorted(converted_data[area][fuel_type], key = lambda i: i['HourUTC'])

    return fuel_types, converted_data


def convert_emission_data(emission_data):
    emission_types = [x[:-6] for x in emission_data[0].keys() if x not in ['HourUTC', 'PriceArea']]

    converted_data = {}
    for area in VALID_AREAS:
        converted_data[area] = {}
        for emission_type in emission_types:
            converted_data[area][emission_type] = []

    for row in emission_data:
        area = row['PriceArea']

        for emission_type in emission_types:
            converted_data[area][emission_type].append({'HourUTC': row['HourUTC'], 'PerkWh': row[emission_type + 'PerkWh']})

    for area in VALID_AREAS:
        for emission_type in emission_types:
            converted_data[area][emission_type] = sorted(converted_data[area][emission_type], key = lambda i: i['HourUTC'])

    return emission_types, converted_data


def write_to_file(emission_types, fuel_types, emission_data, fuel_data, filename='data.json'):
    with open(filename, 'w') as json_file:
        json_file.write(json.dumps({'emission_types': emission_types,
                                    'fuel_types': fuel_types,
                                    'emission_data': emission_data,
                                    'fuel_data': fuel_data}))


def main():
    fuel_data = retrieve_fuel_data()
    emission_data = retrieve_emission_data()

    fuel_types, converted_fuel_data = convert_fuel_data(fuel_data)
    emission_types, converted_emission_data = convert_emission_data(emission_data)

    write_to_file(emission_types, fuel_types, converted_emission_data, converted_fuel_data)


if __name__ == '__main__':
    main()
