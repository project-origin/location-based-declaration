import csv
import json
import requests
from requests.utils import requote_uri

VALID_AREAS = ['DK1', 'DK2']
YEAR = '2019'

GROUP_FUELS = {
    "Offshore": "Vind",
    "Onshore": "Vind",
    "Solceller": "Sol",
    "Sol": "Sol",
    "Anden VE": "Vandkraft",
    "Vandkraft": "Vandkraft",
    "Biogas": "Biomasse",
    "Træ_mm": "Biomasse",
    "Halm": "Biomasse",
    "Affald": "Affald",
    "Naturgas": "Naturgas",
    "Brunkul": "Kul og Olie",
    "Kul": "Kul og Olie",
    "Fuelolie": "Kul og Olie",
    "Gasolie": "Kul og Olie",
    "Olie": "Kul og Olie",
    "Atomkraft": "Atomkraft"
}

FUEL_TYPES = list(set(GROUP_FUELS.values()))


def retrieve_fuel_data():
    url = f'https://www.energidataservice.dk/proxy/api/datastore_search_sql?sql=\
          SELECT "HourUTC", "PriceArea", "ConnectedArea", "ProductionGroup", "Share" \
          FROM "declconscoveragehour" \
          WHERE "HourDK" >= \'{YEAR}-01-01\' AND "HourDK" <= \'{YEAR}-12-31\' \
          ORDER BY "HourUTC" ASC'

    response = requests.get(requote_uri(url))
    records = response.json()['result']['records']

    for record in records:
        record['ProductionGroup'] = GROUP_FUELS[record['ProductionGroup']]
        record['PriceArea'] = record['PriceArea'].upper()

    return records


def retrieve_emission_data():
    url = f'https://www.energidataservice.dk/proxy/api/datastore_search_sql?sql=\
           SELECT "HourUTC", "PriceArea", "Co2PerkWh" \
           FROM "declarationemissionhour" \
           WHERE "HourDK" >= \'{YEAR}-01-01\' AND "HourDK" <= \'{YEAR}-12-31\' \
           ORDER BY "HourUTC" ASC'

    response = requests.get(requote_uri(url))
    records = response.json()['result']['records']

    return records


def calculate_kwh_per_hour(fuel_data):
    kwh_hourly = {}
    fuel_types = set()

    for row in fuel_data:
        hour = row['HourUTC']
        area = row['PriceArea']
        consumed = row['ConsumedDK'] * 1000 # convert from MWh to kWh.

        kwh_hourly[(hour, area)] = kwh_hourly.get((hour, area), 0) + consumed

        fuel_types['']

        fuel_types.add(row['DKFuelType'])

    return list(fuel_types), kwh_hourly

def fill_missing_fuel_type_per_hour(fuel_data):
    filled_fuel_data = {}

    for area in VALID_AREAS:
        filled_fuel_data[area] = {}

    for row in fuel_data:
        hour = row['HourUTC']
        area = row['PriceArea']
        fuelType = row['ProductionGroup']

        if not hour in filled_fuel_data[area]:
            filled_fuel_data[area][hour] = {}

        filled_fuel_data[area][hour][fuelType] = filled_fuel_data[area][hour].get(fuelType, 0) + row['Share']

    return filled_fuel_data

def convert_fuel_data(fuel_data):
    converted_data = {}
    for area in VALID_AREAS:
        converted_data[area] = {}
        for fuel_type in FUEL_TYPES:
            converted_data[area][fuel_type] = []

    filled_fuel_data = fill_missing_fuel_type_per_hour(fuel_data)

    for area in VALID_AREAS:

        for hour in filled_fuel_data[area]:
            test = 0
            for fuel_type in FUEL_TYPES:

                share = filled_fuel_data[area][hour].get(fuel_type, 0)

                test += share

                converted_data[area][fuel_type].append({'HourUTC': hour,'Share': share})

            if test != 1:
                print(test)

    for area in VALID_AREAS:
        for fuel_type in FUEL_TYPES:
            converted_data[area][fuel_type] = sorted(converted_data[area][fuel_type], key = lambda i: i['HourUTC'])

    return converted_data


def convert_emission_data(emission_data):
    emission_types = [x[:-6] for x in emission_data[0].keys() if x not in ['HourUTC', 'PriceArea']]

    converted_data = {}
    for area in VALID_AREAS:
        converted_data[area] = {}
        for emission_type in emission_types:
            converted_data[area][emission_type] = []

    for row in emission_data:
        area =  "DK1" #row['PriceArea']

        for emission_type in emission_types:
            try:
                converted_data[area][emission_type].append({'HourUTC': row['HourUTC'], 'PerkWh': row[emission_type + 'PerkWh']})
            except KeyError:
                print("Emission_type: ",emission_type)
                print("Emission_types: ",emission_types)

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

    converted_fuel_data = convert_fuel_data(fuel_data)
    emission_types, converted_emission_data = convert_emission_data(emission_data)

    write_to_file(emission_types, FUEL_TYPES, converted_emission_data, converted_fuel_data)


if __name__ == '__main__':
    main()
