import { Module } from '@nestjs/common';
import { BankModule } from '../bank/bank.module';
import { OperationsService } from './operations.service';

@Module({ imports: [BankModule], providers: [OperationsService], exports: [OperationsService] })
export class OperationsModule {}
