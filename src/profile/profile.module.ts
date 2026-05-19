import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { PublicProfileService } from './public-profile.service';
import { UsersController } from './users.controller';
import { EditProfileService } from './edit-profile.service';

@Module({
  controllers: [ProfileController, UsersController],
  providers: [ProfileService, PublicProfileService, EditProfileService],
})
export class ProfileModule {}
