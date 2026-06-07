from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base schema that speaks camelCase on the wire while staying snake_case in Python.

    ``from_attributes`` lets response models be validated directly from ORM/SQLModel
    instances (e.g. ``UserPublic.model_validate(user)``).
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
        from_attributes=True,
    )
