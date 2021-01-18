import { getCustomRepository, getRepository } from 'typeorm';
import StartDeliveryRequest from '../request/delivery/startDelivery.request';
import DeliveryRepository from '../repository/delivery.repository';
import { Delivery } from '../entity/delivery';
import HttpError from '../error/httpError';
import { convertToAddress } from '../thirdParty/google';
import CreateDeliveryRequest from '../request/delivery/createDelivery.request';
import UserService from './user.service';
import Role from '../enum/Role';

export default class DeliveryService {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getDelivery = async (idx: number): Promise<Delivery | undefined> => {
    const deliveryRepository = getCustomRepository(DeliveryRepository);
    const delivery = await deliveryRepository.findOne(idx);

    return delivery;
  }

  getCompletedDeliveriesByDate = async (date: string): Promise<Delivery[]> => {
    const deliveryRepository = getCustomRepository(DeliveryRepository);
    const deliveries = await deliveryRepository.findByEndTime(date);

    return deliveries;
  }

  getDeliveringDeliveries = async (): Promise<Delivery[]> => {
    const deliveryRepository = getCustomRepository(DeliveryRepository);
    const deliveries = await deliveryRepository.findEndTimeIsNull();

    return deliveries;
  }

  private validateUserRole = async (customerIdx: number, driverIdx: number) => {
    const driver = await this.userService.getUser(driverIdx);
    const customer = await this.userService.getUser(customerIdx);

    if (driver === undefined || customer === undefined) {
      throw new HttpError(404, '회원 없음');
    }

    if (driver.role !== Role.DRIVER || customer.role !== Role.CUSTOMER) {
      throw new HttpError(400, '옳지 않은 회원 할당');
    }

    return {
      driver,
      customer,
    }
  }

  createDelivery = async (data: CreateDeliveryRequest): Promise<void> => {
    const deliveryRepository = getCustomRepository(DeliveryRepository);

    const { customerIdx, driverIdx } = data;
    const { customer, driver } = await this.validateUserRole(customerIdx, driverIdx);

    const delivery: Delivery = deliveryRepository.create(data);
    delivery.customer = customer;
    delivery.driver = driver;
    await deliveryRepository.save(delivery);
  }

  startDelivery = async (driverIdx: number, deliveryIdx: number, data: StartDeliveryRequest): Promise<void> => {
    const deliveryRepository = getCustomRepository(DeliveryRepository);

    const delivery = await this.getDelivery(deliveryIdx);
    if (delivery === undefined) {
      throw new HttpError(404, '배송 없음');
    }

    if (delivery.driverIdx !== driverIdx) {
      throw new HttpError(403, '권한 없음');
    }

    const { lat, long } = data;
    const startAddress = await convertToAddress(lat, long);

    delivery.startTime = new Date();
    delivery.startAddress = startAddress;

    deliveryRepository.save(delivery);
  }

  endDelivery = async (driverIdx: number, deliveryIdx: number): Promise<void> => {
    const deliveryRepository = getCustomRepository(DeliveryRepository);

    const delivery = await this.getDelivery(deliveryIdx);
    if (delivery === undefined) {
      throw new HttpError(404, '배송 없음');
    }

    if (delivery.driverIdx !== driverIdx) {
      throw new HttpError(403, '권한 없음');
    }

    if (delivery.startAddress === null) {
      throw new HttpError(400, '아직 배송이 출발하지 않음');
    }

    delivery.endTime = new Date();

    deliveryRepository.save(delivery);
  }

}