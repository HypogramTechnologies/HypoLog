import pandas as pd


class CityRepository:
    def __init__(self, df: pd.DataFrame):
        self._df = df

    def find_destinations(self, search_key: str | None = None, state_code: str | None = None) -> pd.DataFrame:
        df = self._df
        mask = df["is_destination"]

        if search_key:
            mask &= df["city_key"].str.contains(search_key, regex=False)
        if state_code:
            mask &= df["state_code"] == state_code

        return df[mask]

    def get_by_id(self, city_id: int) -> dict | None:
        rows = self._df[self._df["city_id"] == city_id]
        return None if rows.empty else rows.iloc[0].to_dict()

    def find_by_ids(self, city_ids) -> pd.DataFrame:
        return self._df[self._df["city_id"].isin(city_ids)]

    def get_by_key(self, city_key: str, state_code: str) -> dict | None:
        rows = self._df[(self._df["city_key"] == city_key) & (self._df["state_code"] == state_code)]
        return None if rows.empty else rows.iloc[0].to_dict()
