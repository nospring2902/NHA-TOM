import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetPhoneDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;
}
