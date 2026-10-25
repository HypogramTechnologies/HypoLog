from datetime import date

import pandas as pd


class DeliveryRepository:
    """Único ponto que sabe onde os dados estão."""

    def __init__(self, df: pd.DataFrame):
        self._df = df

    def find(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        destination_city_id: int | None = None,
    ) -> pd.DataFrame:
        df = self._df
        mask = pd.Series(True, index=df.index)

        if start_date:
            mask &= df["purchase_date"] >= pd.Timestamp(start_date)
        if end_date:
            # < dia seguinte, para incluir o dia final inteiro
            mask &= df["purchase_date"] < pd.Timestamp(end_date) + pd.Timedelta(days=1)
        if destination_city_id:
            mask &= df["customer_city_id"] == destination_city_id

        return df[mask]